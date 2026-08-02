// ============================================================
// functions/ingest-rss/index.ts
// Supabase Edge Function — RSS Source Fetcher (Task 3)
//
// Fetches from PIB RSS, Alt News RSS, and Factly RSS.
// Writes raw items to ingestion_queue for drain-queue to process.
// Does NOT embed or classify — that happens in drain-queue.
//
// Payload body: { sources: ["pib", "altnews", "factly"] } or { sources: ["all"] }
//
// Future: GDELT RSS/polling would be added as another source here
// or as its own ingest-gdelt Edge Function.
// ============================================================

import { handleCors, corsHeaders } from "../_shared/cors.ts";
import { getAdminClient } from "../_shared/supabaseClient.ts";

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

// Source configs: name in sources table, RSS URL, lane, max items, default topic slug
const RSS_SOURCES = [
  {
    key: "pib",
    sourceName: "PIB",
    url: "https://pib.gov.in/RssMain.aspx",
    isDirectRecord: true,
    defaultTopicSlug: "government",
    maxItems: 20,
  },
  {
    key: "altnews",
    sourceName: "Alt News",
    url: "https://www.altnews.in/feed",
    isDirectRecord: false,
    defaultTopicSlug: "protests",
    maxItems: 20,
  },
  {
    key: "factly",
    sourceName: "Factly",
    url: "https://factly.in/feed",
    isDirectRecord: false,
    defaultTopicSlug: "elections",
    maxItems: 20,
  },
  // ── New sources (verified RSS feeds) ──────────────────────
  {
    key: "indianexpress",
    sourceName: "Indian Express",
    url: "https://indianexpress.com/feed/",
    isDirectRecord: true,
    defaultTopicSlug: "government",
    maxItems: 20,
  },
  {
    key: "thehindu",
    sourceName: "The Hindu",
    url: "https://www.thehindu.com/feeder/default.rss",
    isDirectRecord: true,
    defaultTopicSlug: "government",
    maxItems: 20,
  },
  {
    key: "zeenews",
    sourceName: "Zee News",
    url: "https://zeenews.india.com/rss/india-news.xml",
    isDirectRecord: true,
    defaultTopicSlug: "government",
    maxItems: 20,
  },
  {
    key: "tv9hindi",
    sourceName: "TV9 Hindi",
    url: "https://tv9hindi.com/feed",
    isDirectRecord: true,
    defaultTopicSlug: "government",
    maxItems: 15,
  },
  // ── Verified Claims lane ──────────────────────────────────
  {
    key: "vishvasnews",
    sourceName: "Vishvas News",
    url: "https://vishvasnews.com/feed",
    isDirectRecord: false, // Lane 2: fact-checker, needs corroboration
    defaultTopicSlug: "government",
    maxItems: 15,
  },
  // NOTE: ANI skipped — B2B wire service, no public RSS (403).
  // NOTE: Jagran skipped — no maintained public RSS (404 on all paths).
  // NOTE: IANS skipped — no public feed; Adani Group majority
  //       ownership since Dec 2023 would need factoring into
  //       authority tier if revisited.
] as const;

Deno.serve(async (req: Request) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  try {
    const supabase = getAdminClient();
    const body = await req.json().catch(() => ({}));
    const requestedSources: string[] = body.sources ?? ["all"];
    const isAll = requestedSources.includes("all");

    const results: Record<string, number> = {};

    for (const src of RSS_SOURCES) {
      if (!isAll && !requestedSources.includes(src.key)) continue;

      try {
        const items = await fetchRss(src.url);
        let enqueued = 0;

        for (const item of items.slice(0, src.maxItems)) {
          // Skip items without a usable link (used for dedup in drain-queue)
          if (!item.link) continue;

          const { error } = await supabase.from("ingestion_queue").insert({
            source_name: src.sourceName,
            source_type: "rss",
            payload: {
              headline: item.title,
              raw_content: item.description,
              normalized_content: item.description,
              source_url: item.link,
              published_at: item.pubDate || null,
              is_direct_record: src.isDirectRecord,
              default_topic_slug: src.defaultTopicSlug,
            },
          });

          if (!error) enqueued++;
        }

        results[src.key] = enqueued;
      } catch (srcErr) {
        console.error(`RSS fetch error for ${src.key}:`, (srcErr as Error).message);
        results[src.key] = 0;
      }
    }

    return new Response(
      JSON.stringify({ success: true, enqueued: results }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 },
    );
  } catch (err) {
    console.error("ingest-rss error:", err);
    return new Response(
      JSON.stringify({ success: false, error: (err as Error).message }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 },
    );
  }
});
