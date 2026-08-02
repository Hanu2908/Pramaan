// ============================================================
// functions/drain-queue/index.ts
// Supabase Edge Function — Queue Drain Worker (Tasks 1 + 3)
//
// Reads pending items from ingestion_queue, generates embeddings,
// runs deduplication (Task 1), and writes to evidence_items.
//
// Schedule: every 15 minutes via pg_cron.
// Batch size: 20 items per invocation to stay within Edge Function
// execution limits and Gemini embedding rate limits.
// ============================================================

import { handleCors, corsHeaders } from "../_shared/cors.ts";
import { getAdminClient } from "../_shared/supabaseClient.ts";
import { generateEmbedding } from "../_shared/gemini.ts";
import { findDuplicate, mergeIntoStory } from "../_shared/dedup.ts";

const BATCH_SIZE = 20;

// ── Helpers (reused from original ingest-news) ───────────────

async function getSourceId(
  supabase: ReturnType<typeof getAdminClient>,
  name: string,
): Promise<string | null> {
  const { data } = await supabase
    .from("sources")
    .select("id")
    .eq("name", name)
    .maybeSingle();

  if (data?.id) return data.id;

  // Fallback: fuzzy match
  const { data: fallback } = await supabase
    .from("sources")
    .select("id")
    .ilike("name", `%${name}%`)
    .limit(1)
    .maybeSingle();

  return fallback?.id ?? null;
}

async function getTopicIdBySlug(
  supabase: ReturnType<typeof getAdminClient>,
  slug: string,
): Promise<string | null> {
  const { data } = await supabase
    .from("topics")
    .select("id")
    .eq("slug", slug)
    .maybeSingle();
  return data?.id ?? null;
}

// ── Queue item payload shape (matches what source fetchers write) ─
interface QueuePayload {
  headline: string;
  raw_content: string;
  normalized_content: string;
  source_url: string;
  image_url?: string | null;
  published_at?: string | null;
  is_direct_record: boolean;
  default_topic_slug: string;
}

// ── Main Handler ─────────────────────────────────────────────
Deno.serve(async (req: Request) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  const supabase = getAdminClient();

  try {
    // 1. Fetch oldest pending items
    const { data: queueItems, error: fetchErr } = await supabase
      .from("ingestion_queue")
      .select("*")
      .eq("status", "pending")
      .order("created_at", { ascending: true })
      .limit(BATCH_SIZE);

    if (fetchErr) throw fetchErr;
    if (!queueItems || queueItems.length === 0) {
      return new Response(
        JSON.stringify({ success: true, processed: 0, message: "Queue empty" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 },
      );
    }

    // 2. Mark batch as processing
    const batchIds = queueItems.map((q) => q.id);
    await supabase
      .from("ingestion_queue")
      .update({ status: "processing" })
      .in("id", batchIds);

    // Cache for source/topic lookups
    const sourceIdCache = new Map<string, string | null>();
    const topicIdCache = new Map<string, string | null>();
    const defaultTopicId = await getTopicIdBySlug(supabase, "government");

    let processed = 0;
    let deduplicated = 0;
    let errors = 0;

    // 3. Process each item
    for (const queueItem of queueItems) {
      try {
        const payload = queueItem.payload as QueuePayload;

        // Resolve source_id (cached)
        if (!sourceIdCache.has(queueItem.source_name)) {
          sourceIdCache.set(queueItem.source_name, await getSourceId(supabase, queueItem.source_name));
        }
        const sourceId = sourceIdCache.get(queueItem.source_name);
        if (!sourceId) {
          throw new Error(`Source not found: ${queueItem.source_name}`);
        }

        // Resolve topic_id (cached)
        const topicSlug = payload.default_topic_slug ?? "government";
        if (!topicIdCache.has(topicSlug)) {
          topicIdCache.set(topicSlug, await getTopicIdBySlug(supabase, topicSlug));
        }
        const topicId = topicIdCache.get(topicSlug) ?? defaultTopicId;

        // Check for exact URL duplicate (same as original upsertEvidence)
        const { data: urlDup } = await supabase
          .from("evidence_items")
          .select("id")
          .eq("source_url", payload.source_url)
          .maybeSingle();

        if (urlDup) {
          // Already ingested by URL — skip silently
          await supabase
            .from("ingestion_queue")
            .update({ status: "done", processed_at: new Date().toISOString() })
            .eq("id", queueItem.id);
          processed++;
          continue;
        }

        // Generate embedding
        const textForEmbedding = `${payload.headline}. ${payload.normalized_content}`.slice(0, 2048);
        const embedding = await generateEmbedding(textForEmbedding, "RETRIEVAL_DOCUMENT");

        // Task 1: Dedup check — cosine similarity against 48h window
        const duplicate = await findDuplicate(supabase, embedding);

        if (duplicate) {
          // Duplicate found: merge into existing story cluster
          await mergeIntoStory(
            supabase,
            duplicate.id,
            duplicate.story_id,
            {
              source_id: sourceId,
              topic_id: topicId,
              headline: payload.headline,
              raw_content: payload.raw_content,
              normalized_content: payload.normalized_content,
              source_url: payload.source_url,
              image_url: payload.image_url ?? null,
              published_at: payload.published_at
                ? new Date(payload.published_at).toISOString()
                : null,
              is_direct_record: payload.is_direct_record,
              embedding,
            },
          );
          deduplicated++;
        } else {
          // New story: insert and set story_id = own id
          const { data: inserted, error: insertErr } = await supabase
            .from("evidence_items")
            .insert({
              source_id: sourceId,
              topic_id: topicId,
              headline: payload.headline,
              raw_content: payload.raw_content,
              normalized_content: payload.normalized_content,
              source_url: payload.source_url,
              image_url: payload.image_url ?? null,
              published_at: payload.published_at
                ? new Date(payload.published_at).toISOString()
                : null,
              is_direct_record: payload.is_direct_record,
              embedding,
            })
            .select("id")
            .single();

          if (insertErr || !inserted) {
            throw new Error(`Insert failed: ${insertErr?.message}`);
          }

          // Self-reference: this item is its own story root
          await supabase
            .from("evidence_items")
            .update({ story_id: inserted.id })
            .eq("id", inserted.id);
        }

        // Mark queue item done
        await supabase
          .from("ingestion_queue")
          .update({ status: "done", processed_at: new Date().toISOString() })
          .eq("id", queueItem.id);

        processed++;
      } catch (itemErr) {
        console.error(`Queue item ${queueItem.id} failed:`, (itemErr as Error).message);
        errors++;

        await supabase
          .from("ingestion_queue")
          .update({
            status: "error",
            error_message: (itemErr as Error).message,
            processed_at: new Date().toISOString(),
          })
          .eq("id", queueItem.id);
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        processed,
        deduplicated,
        errors,
        batch_size: queueItems.length,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 },
    );
  } catch (err) {
    console.error("drain-queue error:", err);
    return new Response(
      JSON.stringify({ success: false, error: (err as Error).message }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 },
    );
  }
});
