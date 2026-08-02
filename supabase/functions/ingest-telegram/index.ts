// ============================================================
// functions/ingest-telegram/index.ts
// Supabase Edge Function — PIB Telegram Fetcher (Task 3)
//
// Scrapes @PIB_FactCheck Telegram public feed.
// Writes raw items to ingestion_queue for drain-queue to process.
// Does NOT embed or classify.
// ============================================================

import { handleCors, corsHeaders } from "../_shared/cors.ts";
import { getAdminClient } from "../_shared/supabaseClient.ts";

interface TelegramItem {
  headline: string;
  text: string;
  link: string;
  topicSlug: string;
}

async function fetchPibTelegram(): Promise<TelegramItem[]> {
  const url = "https://t.me/s/PIB_FactCheck";
  const res = await fetch(url, {
    headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36" },
  });
  if (!res.ok) return [];

  const html = await res.text();
  const items: TelegramItem[] = [];

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
        headline,
        text,
        link: `https://t.me/PIB_FactCheck/${count}`,
        topicSlug,
      });
    }
  }
  return items;
}

Deno.serve(async (req: Request) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  try {
    const supabase = getAdminClient();
    const items = await fetchPibTelegram();
    let enqueued = 0;

    for (const item of items.slice(0, 15)) {
      const { error } = await supabase.from("ingestion_queue").insert({
        source_name: "PIB Fact Check",
        source_type: "telegram",
        payload: {
          headline: item.headline,
          raw_content: item.text,
          normalized_content: item.text,
          source_url: item.link,
          published_at: new Date().toISOString(),
          is_direct_record: true, // PIB Fact Check is Lane 1
          default_topic_slug: item.topicSlug,
        },
      });

      if (!error) enqueued++;
    }

    return new Response(
      JSON.stringify({ success: true, enqueued }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 },
    );
  } catch (err) {
    console.error("ingest-telegram error:", err);
    return new Response(
      JSON.stringify({ success: false, error: (err as Error).message }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 },
    );
  }
});
