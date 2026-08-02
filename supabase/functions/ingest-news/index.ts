// ============================================================
// functions/ingest-news/index.ts
// Supabase Edge Function — Backward-Compatible Ingestion Wrapper
//
// LEGACY WRAPPER: This function is preserved for backward
// compatibility with existing manual invocations and integrations.
// It delegates to the ingestion_queue (Task 3) instead of
// inserting directly into evidence_items.
//
// New per-source functions: ingest-rss, ingest-telegram,
// ingest-acled, ingest-newsdata. Queue is drained by drain-queue.
// ============================================================

import { handleCors, corsHeaders } from "../_shared/cors.ts";
import { getAdminClient } from "../_shared/supabaseClient.ts";

// ── Source Fetchers (kept inline for backward compat) ────────

interface RssItem {
  title: string;
  link: string;
  description: string;
  pubDate: string;
  topicSlug?: string;
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
      block.match(new RegExp(`<${tag}[^>]*><!\\\[CDATA\\\[([\\s\\S]*?)\\\]\\\]><\\/${tag}>`))?.[1]
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

async function fetchPibTelegram(): Promise<RssItem[]> {
  const url = "https://t.me/s/PIB_FactCheck";
  const res = await fetch(url, {
    headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36" },
  });
  if (!res.ok) return [];

  const html = await res.text();
  const items: RssItem[] = [];

  const messageBlocks = html.matchAll(/<div class="tgme_widget_message_text[^"]*"[^>]*>([\s\S]*?)<\/div>/g);
  let count = 0;
  for (const match of messageBlocks) {
    count++;
    const rawText = match[1];
    const text = rawText
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<[^>]+>/g, "")
      .replace(/&quot;/g, '"')
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .trim();

    if (text.length > 20) {
      const lines = text.split("\n").filter((l) => l.trim().length > 0);
      const headline = lines[0].slice(0, 120);

      const lower = text.toLowerCase();
      let topicSlug = "government";
      if (lower.includes("deepfake") || lower.includes("ai-generated") || lower.includes("synthetic")) {
        topicSlug = "deepfake";
      } else if (lower.includes("protest") || lower.includes("clash") || lower.includes("police")) {
        topicSlug = "protests";
      } else if (lower.includes("election") || lower.includes("vote") || lower.includes("evm")) {
        topicSlug = "elections";
      } else if (lower.includes("health") || lower.includes("virus") || lower.includes("dengue") || lower.includes("hospital")) {
        topicSlug = "health";
      } else if (lower.includes("army") || lower.includes("military") || lower.includes("defense") || lower.includes("border")) {
        topicSlug = "conflict";
      }

      items.push({
        title: headline,
        link: `https://t.me/PIB_FactCheck/${count}`,
        description: text,
        pubDate: new Date().toISOString(),
        topicSlug,
      });
    }
  }
  return items;
}

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

// ── Enqueue Helper ───────────────────────────────────────────
// Writes a raw item to ingestion_queue instead of directly inserting
// into evidence_items. Embedding + dedup happens in drain-queue.

async function enqueueItem(
  supabase: ReturnType<typeof getAdminClient>,
  sourceName: string,
  sourceType: "rss" | "telegram" | "acled" | "newsdata",
  payload: Record<string, unknown>,
): Promise<boolean> {
  const { error } = await supabase.from("ingestion_queue").insert({
    source_name: sourceName,
    source_type: sourceType,
    payload,
  });
  return !error;
}

// ── Main Handler ─────────────────────────────────────────────
Deno.serve(async (req: Request) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  try {
    const supabase = getAdminClient();
    const body = await req.json().catch(() => ({}));
    const source: string = body.source ?? "all";

    const results: Record<string, number> = {};

    // ── PIB RSS ──────────────────────────────────────────────
    if (source === "all" || source === "pib") {
      try {
        const items = await fetchRss("https://pib.gov.in/RssMain.aspx");
        let count = 0;
        for (const item of items.slice(0, 20)) {
          if (!item.link) continue;
          const ok = await enqueueItem(supabase, "PIB", "rss", {
            headline: item.title,
            raw_content: item.description,
            normalized_content: item.description,
            source_url: item.link,
            published_at: item.pubDate || null,
            is_direct_record: true,
            default_topic_slug: "government",
          });
          if (ok) count++;
        }
        results["pib"] = count;
      } catch (e) { console.error("PIB RSS error:", e); results["pib"] = 0; }
    }

    // ── PIB Telegram (@PIB_FactCheck) ────────────────────────
    if (source === "all" || source === "pib_telegram") {
      try {
        const items = await fetchPibTelegram();
        let count = 0;
        for (const item of items.slice(0, 15)) {
          const ok = await enqueueItem(supabase, "PIB Fact Check", "telegram", {
            headline: item.title,
            raw_content: item.description,
            normalized_content: item.description,
            source_url: item.link,
            published_at: item.pubDate,
            is_direct_record: true,
            default_topic_slug: item.topicSlug ?? "government",
          });
          if (ok) count++;
        }
        results["pib_telegram"] = count;
      } catch (e) { console.error("PIB Telegram error:", e); results["pib_telegram"] = 0; }
    }

    // ── Alt News RSS ─────────────────────────────────────────
    if (source === "all" || source === "altnews") {
      try {
        const items = await fetchRss("https://www.altnews.in/feed");
        let count = 0;
        for (const item of items.slice(0, 20)) {
          if (!item.link) continue;
          const ok = await enqueueItem(supabase, "Alt News", "rss", {
            headline: item.title,
            raw_content: item.description,
            normalized_content: item.description,
            source_url: item.link,
            published_at: item.pubDate || null,
            is_direct_record: false,
            default_topic_slug: "protests",
          });
          if (ok) count++;
        }
        results["altnews"] = count;
      } catch (e) { console.error("Alt News error:", e); results["altnews"] = 0; }
    }

    // ── Factly RSS ───────────────────────────────────────────
    if (source === "all" || source === "factly") {
      try {
        const items = await fetchRss("https://factly.in/feed");
        let count = 0;
        for (const item of items.slice(0, 20)) {
          if (!item.link) continue;
          const ok = await enqueueItem(supabase, "Factly", "rss", {
            headline: item.title,
            raw_content: item.description,
            normalized_content: item.description,
            source_url: item.link,
            published_at: item.pubDate || null,
            is_direct_record: false,
            default_topic_slug: "elections",
          });
          if (ok) count++;
        }
        results["factly"] = count;
      } catch (e) { console.error("Factly error:", e); results["factly"] = 0; }
    }

    // ── NewsData.io ──────────────────────────────────────────
    if (source === "all" || source === "newsdata") {
      try {
        const articles = await fetchNewsData();
        let count = 0;
        for (const article of articles.slice(0, 20)) {
          const content = article.description ?? article.title;
          const ok = await enqueueItem(supabase, "NewsData.io", "newsdata", {
            headline: article.title,
            raw_content: content,
            normalized_content: content,
            source_url: article.link,
            image_url: article.image_url ?? null,
            published_at: article.pubDate ?? null,
            is_direct_record: false,
            default_topic_slug: "government",
          });
          if (ok) count++;
        }
        results["newsdata"] = count;
      } catch (e) { console.error("NewsData error:", e); results["newsdata"] = 0; }
    }

    // ── ACLED ────────────────────────────────────────────────
    if (source === "all" || source === "acled") {
      try {
        const events = await fetchAcled();
        let count = 0;
        for (const event of events) {
          const content = `${event.event_type} in ${event.location}, India on ${event.event_date}. ${event.notes}. Actors: ${event.actor1}${event.actor2 ? `, ${event.actor2}` : ""}. Fatalities: ${event.fatalities}.`;
          const ok = await enqueueItem(supabase, "ACLED", "acled", {
            headline: `${event.event_type}: ${event.location} (${event.event_date})`,
            raw_content: content,
            normalized_content: content,
            source_url: `https://acleddata.com/data-export-tool/?data_id=${event.data_id}`,
            published_at: event.event_date,
            is_direct_record: true,
            default_topic_slug: "conflict",
          });
          if (ok) count++;
        }
        results["acled"] = count;
      } catch (e) { console.error("ACLED error:", e); results["acled"] = 0; }
    }

    // ── Indian Express RSS ───────────────────────────────────
    if (source === "all" || source === "indianexpress") {
      try {
        const items = await fetchRss("https://indianexpress.com/feed/");
        let count = 0;
        for (const item of items.slice(0, 20)) {
          if (!item.link) continue;
          const ok = await enqueueItem(supabase, "Indian Express", "rss", {
            headline: item.title,
            raw_content: item.description,
            normalized_content: item.description,
            source_url: item.link,
            published_at: item.pubDate || null,
            is_direct_record: true,
            default_topic_slug: "government",
          });
          if (ok) count++;
        }
        results["indianexpress"] = count;
      } catch (e) { console.error("Indian Express error:", e); results["indianexpress"] = 0; }
    }

    // ── The Hindu RSS ────────────────────────────────────────
    if (source === "all" || source === "thehindu") {
      try {
        const items = await fetchRss("https://www.thehindu.com/feeder/default.rss");
        let count = 0;
        for (const item of items.slice(0, 20)) {
          if (!item.link) continue;
          const ok = await enqueueItem(supabase, "The Hindu", "rss", {
            headline: item.title,
            raw_content: item.description,
            normalized_content: item.description,
            source_url: item.link,
            published_at: item.pubDate || null,
            is_direct_record: true,
            default_topic_slug: "government",
          });
          if (ok) count++;
        }
        results["thehindu"] = count;
      } catch (e) { console.error("The Hindu error:", e); results["thehindu"] = 0; }
    }

    // ── Zee News RSS ─────────────────────────────────────────
    if (source === "all" || source === "zeenews") {
      try {
        const items = await fetchRss("https://zeenews.india.com/rss/india-news.xml");
        let count = 0;
        for (const item of items.slice(0, 20)) {
          if (!item.link) continue;
          const ok = await enqueueItem(supabase, "Zee News", "rss", {
            headline: item.title,
            raw_content: item.description,
            normalized_content: item.description,
            source_url: item.link,
            published_at: item.pubDate || null,
            is_direct_record: true,
            default_topic_slug: "government",
          });
          if (ok) count++;
        }
        results["zeenews"] = count;
      } catch (e) { console.error("Zee News error:", e); results["zeenews"] = 0; }
    }

    // ── TV9 Hindi RSS ────────────────────────────────────────
    if (source === "all" || source === "tv9hindi") {
      try {
        const items = await fetchRss("https://tv9hindi.com/feed");
        let count = 0;
        for (const item of items.slice(0, 15)) {
          if (!item.link) continue;
          const ok = await enqueueItem(supabase, "TV9 Hindi", "rss", {
            headline: item.title,
            raw_content: item.description,
            normalized_content: item.description,
            source_url: item.link,
            published_at: item.pubDate || null,
            is_direct_record: true,
            default_topic_slug: "government",
          });
          if (ok) count++;
        }
        results["tv9hindi"] = count;
      } catch (e) { console.error("TV9 Hindi error:", e); results["tv9hindi"] = 0; }
    }

    // ── Vishvas News RSS (Verified Claims lane) ──────────────
    if (source === "all" || source === "vishvasnews") {
      try {
        const items = await fetchRss("https://vishvasnews.com/feed");
        let count = 0;
        for (const item of items.slice(0, 15)) {
          if (!item.link) continue;
          const ok = await enqueueItem(supabase, "Vishvas News", "rss", {
            headline: item.title,
            raw_content: item.description,
            normalized_content: item.description,
            source_url: item.link,
            published_at: item.pubDate || null,
            is_direct_record: false, // Lane 2: fact-checker
            default_topic_slug: "government",
          });
          if (ok) count++;
        }
        results["vishvasnews"] = count;
      } catch (e) { console.error("Vishvas News error:", e); results["vishvasnews"] = 0; }
    }

    return new Response(JSON.stringify({ success: true, enqueued: results }), {
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
