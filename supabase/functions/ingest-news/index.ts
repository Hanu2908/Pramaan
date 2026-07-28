// ============================================================
// functions/ingest-news/index.ts
// Supabase Edge Function — Scheduled Ingestion
//
// Pulls from NewsData.io, PIB RSS, Alt News RSS, Factly RSS,
// and ACLED API. Normalizes content, routes to Lane 1 or 2,
// generates Gemini embeddings, and writes to evidence_items.
//
// Trigger: Scheduled via pg_cron (see migration 003)
// ============================================================

import { handleCors, corsHeaders } from "../_shared/cors.ts";
import { getAdminClient } from "../_shared/supabaseClient.ts";
import { generateEmbedding } from "../_shared/gemini.ts";

// ── RSS Parser (minimal, no external library needed) ─────────
interface RssItem {
  title: string;
  link: string;
  description: string;
  pubDate: string;
}

async function fetchRss(url: string): Promise<RssItem[]> {
  const res = await fetch(url, {
    headers: { "User-Agent": "Pramaan-Bot/1.0 (fact-checking; TechFusion 2026)" },
  });
  if (!res.ok) throw new Error(`RSS fetch failed for ${url}: ${res.status}`);

  const xml = await res.text();
  const items: RssItem[] = [];

  // Simple regex-based XML extraction (avoids DOM parser dependency)
  const itemMatches = xml.matchAll(/<item>([\s\S]*?)<\/item>/g);
  for (const match of itemMatches) {
    const block = match[1];
    const get = (tag: string) =>
      block.match(new RegExp(`<${tag}[^>]*><!\\[CDATA\\[([\\s\\S]*?)\\]\\]><\\/${tag}>`))?.[1]
      ?? block.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`))?.[1]?.trim()
      ?? "";

    items.push({
      title: get("title"),
      link: get("link"),
      description: get("description").replace(/<[^>]+>/g, " ").trim(),
      pubDate: get("pubDate"),
    });
  }
  return items;
}

// ── NewsData.io ──────────────────────────────────────────────
interface NewsDataArticle {
  title: string;
  link: string;
  description: string | null;
  pubDate: string | null;
  source_url: string;
  image_url: string | null;
}

async function fetchNewsData(): Promise<NewsDataArticle[]> {
  const apiKey = Deno.env.get("NEWSDATA_API_KEY");
  if (!apiKey) throw new Error("Missing NEWSDATA_API_KEY");

  const url = new URL("https://newsdata.io/api/1/latest");
  url.searchParams.set("country", "in");
  url.searchParams.set("language", "en");
  url.searchParams.set("apikey", apiKey);

  const res = await fetch(url.toString());
  if (!res.ok) throw new Error(`NewsData.io error: ${res.status}`);

  const data = await res.json();
  return (data.results ?? []) as NewsDataArticle[];
}

// ── ACLED ────────────────────────────────────────────────────
interface AcledEvent {
  data_id: number;
  event_date: string;
  event_type: string;
  sub_event_type: string;
  country: string;
  location: string;
  actor1: string;
  actor2: string;
  notes: string;
  source: string;
  source_scale: string;
  fatalities: number;
}

async function fetchAcled(daysPast = 14): Promise<AcledEvent[]> {
  const key = Deno.env.get("ACLED_KEY");
  const email = Deno.env.get("ACLED_EMAIL");
  if (!key || !email) throw new Error("Missing ACLED_KEY or ACLED_EMAIL");

  const endDate = new Date().toISOString().slice(0, 10);
  const startDate = new Date(Date.now() - daysPast * 86400000)
    .toISOString()
    .slice(0, 10);

  const url = new URL("https://api.acleddata.com/acled/read");
  url.searchParams.set("key", key);
  url.searchParams.set("email", email);
  url.searchParams.set("country", "India");
  url.searchParams.set("event_date", `${startDate}|${endDate}`);
  url.searchParams.set("event_type", "Protests");
  url.searchParams.set("limit", "100");
  url.searchParams.set("_format", "json");

  const res = await fetch(url.toString());
  if (!res.ok) throw new Error(`ACLED error: ${res.status}`);

  const data = await res.json();
  return (data.data ?? []) as AcledEvent[];
}

// ── Helpers ──────────────────────────────────────────────────
async function getSourceId(supabase: ReturnType<typeof getAdminClient>, name: string): Promise<string | null> {
  const { data } = await supabase
    .from("sources")
    .select("id")
    .eq("name", name)
    .single();
  return data?.id ?? null;
}

/**
 * Upsert an evidence item. Skips if source_url already exists.
 * Generates embedding async after insert.
 */
async function upsertEvidence(
  supabase: ReturnType<typeof getAdminClient>,
  item: {
    sourceId: string;
    topicId?: string | null;
    headline: string;
    rawContent: string;
    normalizedContent: string;
    sourceUrl: string;
    imageUrl?: string | null;
    publishedAt?: string | null;
    isDirectRecord: boolean;
  },
): Promise<string | null> {
  // Skip if already ingested (idempotent)
  const { data: existing } = await supabase
    .from("evidence_items")
    .select("id")
    .eq("source_url", item.sourceUrl)
    .maybeSingle();

  if (existing) return null;

  // Insert
  const { data, error } = await supabase
    .from("evidence_items")
    .insert({
      source_id: item.sourceId,
      topic_id: item.topicId ?? null,
      headline: item.headline,
      raw_content: item.rawContent,
      normalized_content: item.normalizedContent,
      source_url: item.sourceUrl,
      image_url: item.imageUrl ?? null,
      published_at: item.publishedAt
        ? new Date(item.publishedAt).toISOString()
        : null,
      is_direct_record: item.isDirectRecord,
    })
    .select("id")
    .single();

  if (error || !data) {
    console.error("Insert error:", error?.message);
    return null;
  }

  // Generate and save embedding asynchronously
  try {
    const textForEmbedding = `${item.headline}. ${item.normalizedContent}`.slice(0, 2048);
    const embedding = await generateEmbedding(textForEmbedding, "RETRIEVAL_DOCUMENT");
    await supabase
      .from("evidence_items")
      .update({ embedding })
      .eq("id", data.id);
  } catch (embErr) {
    console.error("Embedding generation failed:", embErr);
    // Non-fatal: item is still stored without embedding
  }

  return data.id;
}

// ── Main Handler ─────────────────────────────────────────────
Deno.serve(async (req: Request) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  try {
    const supabase = getAdminClient();
    const body = await req.json().catch(() => ({}));
    const source: string = body.source ?? "all"; // 'all' | 'newsdata' | 'pib' | 'altnews' | 'factly' | 'acled'

    const results: Record<string, number> = {};

    // ── PIB RSS ──────────────────────────────────────────────
    if (source === "all" || source === "pib") {
      const pibId = await getSourceId(supabase, "PIB");
      if (pibId) {
        const items = await fetchRss("https://pib.gov.in/RssMain.aspx");
        let count = 0;
        for (const item of items.slice(0, 20)) {
          const id = await upsertEvidence(supabase, {
            sourceId: pibId,
            headline: item.title,
            rawContent: item.description,
            normalizedContent: item.description,
            sourceUrl: item.link,
            publishedAt: item.pubDate,
            isDirectRecord: true, // Lane 1: PIB is primary government source
          });
          if (id) count++;
        }
        results["pib"] = count;
      }
    }

    // ── Alt News RSS ─────────────────────────────────────────
    if (source === "all" || source === "altnews") {
      const altId = await getSourceId(supabase, "Alt News");
      if (altId) {
        const items = await fetchRss("https://www.altnews.in/category/fact-check/feed/");
        let count = 0;
        for (const item of items.slice(0, 20)) {
          const id = await upsertEvidence(supabase, {
            sourceId: altId,
            headline: item.title,
            rawContent: item.description,
            normalizedContent: item.description,
            sourceUrl: item.link,
            publishedAt: item.pubDate,
            isDirectRecord: false, // Lane 2: fact-checks require matching engine
          });
          if (id) count++;
        }
        results["altnews"] = count;
      }
    }

    // ── Factly RSS ───────────────────────────────────────────
    if (source === "all" || source === "factly") {
      const factlyId = await getSourceId(supabase, "Factly");
      if (factlyId) {
        const items = await fetchRss("https://factly.in/category/fact-check/feed/");
        let count = 0;
        for (const item of items.slice(0, 20)) {
          const id = await upsertEvidence(supabase, {
            sourceId: factlyId,
            headline: item.title,
            rawContent: item.description,
            normalizedContent: item.description,
            sourceUrl: item.link,
            publishedAt: item.pubDate,
            isDirectRecord: false, // Lane 2
          });
          if (id) count++;
        }
        results["factly"] = count;
      }
    }

    // ── NewsData.io ──────────────────────────────────────────
    if (source === "all" || source === "newsdata") {
      const newsId = await getSourceId(supabase, "NewsData.io");
      if (newsId) {
        const articles = await fetchNewsData();
        let count = 0;
        for (const article of articles.slice(0, 20)) {
          const content = article.description ?? article.title;
          const id = await upsertEvidence(supabase, {
            sourceId: newsId,
            headline: article.title,
            rawContent: content,
            normalizedContent: content,
            sourceUrl: article.link,
            imageUrl: article.image_url,
            publishedAt: article.pubDate,
            isDirectRecord: false, // Lane 2: aggregator needs engine verification
          });
          if (id) count++;
        }
        results["newsdata"] = count;
      }
    }

    // ── ACLED ────────────────────────────────────────────────
    if (source === "all" || source === "acled") {
      const acledId = await getSourceId(supabase, "ACLED");
      if (acledId) {
        const events = await fetchAcled();
        let count = 0;
        for (const event of events) {
          const content = `${event.event_type} in ${event.location}, India on ${event.event_date}. ${event.notes}. Actors: ${event.actor1}${event.actor2 ? `, ${event.actor2}` : ""}. Fatalities: ${event.fatalities}.`;
          const id = await upsertEvidence(supabase, {
            sourceId: acledId,
            headline: `${event.event_type}: ${event.location} (${event.event_date})`,
            rawContent: content,
            normalizedContent: content,
            sourceUrl: `https://acleddata.com/data-export-tool/?data_id=${event.data_id}`,
            publishedAt: event.event_date,
            isDirectRecord: true, // Lane 1: ACLED is authoritative for conflict data
          });
          if (id) count++;
        }
        results["acled"] = count;
      }
    }

    return new Response(JSON.stringify({ success: true, ingested: results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (err) {
    console.error("ingest-news error:", err);
    return new Response(
      JSON.stringify({ success: false, error: (err as Error).message }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      },
    );
  }
});
