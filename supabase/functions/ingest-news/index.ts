// ============================================================
// functions/ingest-news/index.ts
// Supabase Edge Function — Scheduled Ingestion
//
// Pulls from NewsData.io, PIB RSS, PIB Telegram FactCheck (@PIB_FactCheck),
// Alt News RSS, Factly RSS, and ACLED API.
// Normalizes content, routes to Lane 1 or 2, assigns topic_id,
// and generates Gemini embeddings.
// ============================================================

import { handleCors, corsHeaders } from "../_shared/cors.ts";
import { getAdminClient } from "../_shared/supabaseClient.ts";
import { generateEmbedding } from "../_shared/gemini.ts";

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

// ── PIB Telegram (@PIB_FactCheck) Feed Parser ──────────────
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
    let rawText = match[1];
    let text = rawText
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

      // Infer topic slug based on keywords
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
    .maybeSingle();
  
  if (data?.id) return data.id;

  // Fallback lookup if exact name doesn't match
  const { data: fallback } = await supabase
    .from("sources")
    .select("id")
    .ilike("name", `%${name}%`)
    .limit(1)
    .maybeSingle();

  return fallback?.id ?? null;
}

async function getTopicIdBySlug(supabase: ReturnType<typeof getAdminClient>, slug: string): Promise<string | null> {
  const { data } = await supabase
    .from("topics")
    .select("id")
    .eq("slug", slug)
    .maybeSingle();
  return data?.id ?? null;
}

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
  const { data: existing } = await supabase
    .from("evidence_items")
    .select("id")
    .eq("source_url", item.sourceUrl)
    .maybeSingle();

  if (existing) return null;

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

  try {
    const textForEmbedding = `${item.headline}. ${item.normalizedContent}`.slice(0, 2048);
    const embedding = await generateEmbedding(textForEmbedding, "RETRIEVAL_DOCUMENT");
    await supabase
      .from("evidence_items")
      .update({ embedding })
      .eq("id", data.id);
  } catch (embErr) {
    console.error("Embedding generation failed:", embErr);
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
    const source: string = body.source ?? "all";

    const results: Record<string, number> = {};
    const defaultTopicId = await getTopicIdBySlug(supabase, "government");

    // ── PIB RSS ──────────────────────────────────────────────
    if (source === "all" || source === "pib") {
      const pibId = await getSourceId(supabase, "PIB");
      if (pibId) {
        const items = await fetchRss("https://pib.gov.in/RssMain.aspx");
        let count = 0;
        for (const item of items.slice(0, 20)) {
          const id = await upsertEvidence(supabase, {
            sourceId: pibId,
            topicId: defaultTopicId,
            headline: item.title,
            rawContent: item.description,
            normalizedContent: item.description,
            sourceUrl: item.link,
            publishedAt: item.pubDate,
            isDirectRecord: true, // Lane 1
          });
          if (id) count++;
        }
        results["pib"] = count;
      }
    }

    // ── PIB Telegram (@PIB_FactCheck) ────────────────────────
    if (source === "all" || source === "pib_telegram") {
      const pibId = (await getSourceId(supabase, "PIB Fact Check")) || (await getSourceId(supabase, "PIB"));
      if (pibId) {
        const items = await fetchPibTelegram();
        let count = 0;
        for (const item of items.slice(0, 15)) {
          const itemTopicId = item.topicSlug ? (await getTopicIdBySlug(supabase, item.topicSlug)) : defaultTopicId;
          const id = await upsertEvidence(supabase, {
            sourceId: pibId,
            topicId: itemTopicId || defaultTopicId,
            headline: item.title,
            rawContent: item.description,
            normalizedContent: item.description,
            sourceUrl: item.link,
            publishedAt: item.pubDate,
            isDirectRecord: true, // Lane 1: PIB Fact Check is authoritative
          });
          if (id) count++;
        }
        results["pib_telegram"] = count;
      }
    }

    // ── Alt News RSS ─────────────────────────────────────────
    if (source === "all" || source === "altnews") {
      const altId = await getSourceId(supabase, "Alt News");
      const altTopicId = (await getTopicIdBySlug(supabase, "protests")) || defaultTopicId;
      if (altId) {
        const items = await fetchRss("https://www.altnews.in/feed");
        let count = 0;
        for (const item of items.slice(0, 20)) {
          const id = await upsertEvidence(supabase, {
            sourceId: altId,
            topicId: altTopicId,
            headline: item.title,
            rawContent: item.description,
            normalizedContent: item.description,
            sourceUrl: item.link,
            publishedAt: item.pubDate,
            isDirectRecord: false, // Lane 2
          });
          if (id) count++;
        }
        results["altnews"] = count;
      }
    }

    // ── Factly RSS ───────────────────────────────────────────
    if (source === "all" || source === "factly") {
      const factlyId = await getSourceId(supabase, "Factly");
      const factlyTopicId = (await getTopicIdBySlug(supabase, "elections")) || defaultTopicId;
      if (factlyId) {
        const items = await fetchRss("https://factly.in/feed");
        let count = 0;
        for (const item of items.slice(0, 20)) {
          const id = await upsertEvidence(supabase, {
            sourceId: factlyId,
            topicId: factlyTopicId,
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
            topicId: defaultTopicId,
            headline: article.title,
            rawContent: content,
            normalizedContent: content,
            sourceUrl: article.link,
            imageUrl: article.image_url,
            publishedAt: article.pubDate,
            isDirectRecord: false,
          });
          if (id) count++;
        }
        results["newsdata"] = count;
      }
    }

    // ── ACLED ────────────────────────────────────────────────
    if (source === "all" || source === "acled") {
      const acledId = await getSourceId(supabase, "ACLED");
      const conflictTopicId = (await getTopicIdBySlug(supabase, "conflict")) || defaultTopicId;
      if (acledId) {
        const events = await fetchAcled();
        let count = 0;
        for (const event of events) {
          const content = `${event.event_type} in ${event.location}, India on ${event.event_date}. ${event.notes}. Actors: ${event.actor1}${event.actor2 ? `, ${event.actor2}` : ""}. Fatalities: ${event.fatalities}.`;
          const id = await upsertEvidence(supabase, {
            sourceId: acledId,
            topicId: conflictTopicId,
            headline: `${event.event_type}: ${event.location} (${event.event_date})`,
            rawContent: content,
            normalizedContent: content,
            sourceUrl: `https://acleddata.com/data-export-tool/?data_id=${event.data_id}`,
            publishedAt: event.event_date,
            isDirectRecord: true, // Lane 1
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
