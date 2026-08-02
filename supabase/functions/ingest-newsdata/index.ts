// ============================================================
// functions/ingest-newsdata/index.ts
// Supabase Edge Function — NewsData.io Fetcher (Task 3)
//
// Polls NewsData.io for latest Indian English-language news.
// Writes raw items to ingestion_queue for drain-queue to process.
// Does NOT embed or classify.
//
// Future: GDELT polling would follow this same pattern —
// a new ingest-gdelt Edge Function writing to ingestion_queue
// with source_type = 'gdelt' (add to the source_type check
// constraint in the migration when ready).
// ============================================================

import { handleCors, corsHeaders } from "../_shared/cors.ts";
import { getAdminClient } from "../_shared/supabaseClient.ts";

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

Deno.serve(async (req: Request) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  try {
    const supabase = getAdminClient();
    const articles = await fetchNewsData();
    let enqueued = 0;

    for (const article of articles.slice(0, 20)) {
      const content = article.description ?? article.title;

      const { error } = await supabase.from("ingestion_queue").insert({
        source_name: "NewsData.io",
        source_type: "newsdata",
        payload: {
          headline: article.title,
          raw_content: content,
          normalized_content: content,
          source_url: article.link,
          image_url: article.image_url ?? null,
          published_at: article.pubDate ?? null,
          is_direct_record: false, // Lane 2: aggregated news
          default_topic_slug: "government",
        },
      });

      if (!error) enqueued++;
    }

    return new Response(
      JSON.stringify({ success: true, enqueued }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 },
    );
  } catch (err) {
    console.error("ingest-newsdata error:", err);
    return new Response(
      JSON.stringify({ success: false, error: (err as Error).message }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 },
    );
  }
});
