// ============================================================
// functions/ingest-gdelt/index.ts
// Supabase Edge Function — GDELT 2.0 DOC API Fetcher
//
// Polls GDELT's free DOC API for India-related events.
// Fills the gap ACLED (weekly, conflict-only) leaves for
// ordinary factual events across all topics.
//
// API: https://api.gdeltproject.org/api/v2/doc/doc
// - mode=artlist, format=json, no API key required
// - Queries for "India" within last 30 minutes (timespan=30m)
// - Max 75 records per poll to stay within reasonable limits
//
// Schedule: every 30 minutes via pg_cron.
// All items are Direct Record lane (structured event data).
// ============================================================

import { handleCors, corsHeaders } from "../_shared/cors.ts";
import { getAdminClient } from "../_shared/supabaseClient.ts";

// GDELT DOC API article shape (subset of fields we use)
interface GdeltArticle {
  url: string;
  title: string;
  seendate: string;       // YYYYMMDDTHHMMSSZ
  socialimage: string;
  domain: string;
  language: string;
  sourcecountry: string;
}

interface GdeltResponse {
  articles?: GdeltArticle[];
}

async function fetchGdeltIndia(timespanMinutes = 30): Promise<GdeltArticle[]> {
  const url = new URL("https://api.gdeltproject.org/api/v2/doc/doc");
  url.searchParams.set("query", "india");
  url.searchParams.set("mode", "artlist");
  url.searchParams.set("format", "json");
  url.searchParams.set("maxrecords", "75");
  url.searchParams.set("timespan", `${timespanMinutes}min`);

  const res = await fetch(url.toString(), {
    headers: { "User-Agent": "Pramaan-Bot/1.0 (fact-checking; TechFusion 2026)" },
  });

  if (!res.ok) {
    // GDELT returns 200 even on errors — check for non-200 explicitly
    throw new Error(`GDELT DOC API error: ${res.status}`);
  }

  const data: GdeltResponse = await res.json();

  // Filter to English-language articles about India
  return (data.articles ?? []).filter(
    (a) => a.language === "English" && a.title && a.url,
  );
}

/**
 * Parse GDELT's seendate format (YYYYMMDDTHHMMSSZ) to ISO string.
 */
function parseGdeltDate(seendate: string): string {
  // Format: "20260802T143000Z"
  try {
    const year = seendate.slice(0, 4);
    const month = seendate.slice(4, 6);
    const day = seendate.slice(6, 8);
    const hour = seendate.slice(9, 11);
    const min = seendate.slice(11, 13);
    const sec = seendate.slice(13, 15);
    return `${year}-${month}-${day}T${hour}:${min}:${sec}Z`;
  } catch {
    return new Date().toISOString();
  }
}

Deno.serve(async (req: Request) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  try {
    const supabase = getAdminClient();
    const body = await req.json().catch(() => ({}));
    const timespanMinutes: number = body.timespan_minutes ?? 30;

    const articles = await fetchGdeltIndia(timespanMinutes);
    let enqueued = 0;

    for (const article of articles) {
      // Build a normalized content string from what GDELT gives us
      const content = `${article.title} (via ${article.domain})`;

      const { error } = await supabase.from("ingestion_queue").insert({
        source_name: "GDELT",
        source_type: "gdelt",
        payload: {
          headline: article.title.slice(0, 300),
          raw_content: content,
          normalized_content: content,
          source_url: article.url,
          image_url: article.socialimage || null,
          published_at: parseGdeltDate(article.seendate),
          is_direct_record: true, // Lane 1: structured event data
          default_topic_slug: "government", // Generic; drain-queue can reassign via entity extraction later
        },
      });

      if (!error) enqueued++;
    }

    return new Response(
      JSON.stringify({
        success: true,
        enqueued,
        total_fetched: articles.length,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 },
    );
  } catch (err) {
    console.error("ingest-gdelt error:", err);
    return new Response(
      JSON.stringify({ success: false, error: (err as Error).message }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 },
    );
  }
});
