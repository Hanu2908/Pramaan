// ============================================================
// _shared/dedup.ts
// Deduplication utilities for the ingestion pipeline (Task 1).
// Used by drain-queue to detect and merge near-duplicate items.
// ============================================================

import type { SupabaseClient } from "npm:@supabase/supabase-js@2";

/** Cosine similarity threshold — items above this are considered duplicates. */
export const DEDUP_SIMILARITY_THRESHOLD = 0.90;

/** Only compare against items ingested within this window (hours). */
export const DEDUP_TIME_WINDOW_HOURS = 48;

export interface DuplicateMatch {
  id: string;
  story_id: string | null;
  similarity: number;
}

/**
 * Search evidence_items for a near-duplicate within the time window.
 * Returns the best match (highest similarity) or null if nothing ≥ threshold.
 */
export async function findDuplicate(
  supabase: SupabaseClient,
  embedding: number[],
): Promise<DuplicateMatch | null> {
  const { data, error } = await supabase.rpc("find_duplicate_evidence", {
    query_embedding: embedding,
    time_window_hours: DEDUP_TIME_WINDOW_HOURS,
    similarity_threshold: DEDUP_SIMILARITY_THRESHOLD,
  });

  if (error) {
    console.error("find_duplicate_evidence RPC error:", error.message);
    return null;
  }

  // RPC returns a table; we only take the first (best) row.
  const row = Array.isArray(data) ? data[0] : data;
  if (!row) return null;

  return {
    id: row.id,
    story_id: row.story_id,
    similarity: row.similarity,
  };
}

/**
 * Merge a new item into an existing story cluster.
 *
 * - Determines the canonical story_id (the existing item's story_id,
 *   or the existing item's own id if it wasn't clustered yet).
 * - Inserts the new evidence_item with that story_id.
 * - Ensures the existing item also has story_id set (idempotent).
 *
 * Returns the new evidence_item's id, or null on failure.
 */
export async function mergeIntoStory(
  supabase: SupabaseClient,
  existingItemId: string,
  existingStoryId: string | null,
  newItem: {
    source_id: string;
    topic_id: string | null;
    headline: string;
    raw_content: string;
    normalized_content: string;
    source_url: string;
    image_url?: string | null;
    published_at: string | null;
    is_direct_record: boolean;
    embedding: number[];
  },
): Promise<string | null> {
  // The canonical story_id is the existing cluster's id, or the matched item's own id.
  const canonicalStoryId = existingStoryId ?? existingItemId;

  // Insert the new item linked to the story cluster.
  const { data: inserted, error: insertErr } = await supabase
    .from("evidence_items")
    .insert({
      source_id: newItem.source_id,
      topic_id: newItem.topic_id,
      headline: newItem.headline,
      raw_content: newItem.raw_content,
      normalized_content: newItem.normalized_content,
      source_url: newItem.source_url,
      image_url: newItem.image_url ?? null,
      published_at: newItem.published_at,
      is_direct_record: newItem.is_direct_record,
      embedding: newItem.embedding,
      story_id: canonicalStoryId,
    })
    .select("id")
    .single();

  if (insertErr || !inserted) {
    console.error("mergeIntoStory insert error:", insertErr?.message);
    return null;
  }

  // Ensure the existing item also points to the canonical story_id
  // (no-op if it already does, sets it if this is the first merge).
  if (!existingStoryId) {
    await supabase
      .from("evidence_items")
      .update({ story_id: canonicalStoryId })
      .eq("id", existingItemId);
  }

  return inserted.id;
}
