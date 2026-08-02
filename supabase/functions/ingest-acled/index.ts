// ============================================================
// functions/ingest-acled/index.ts
// Supabase Edge Function — ACLED Event Data Fetcher (Task 3)
//
// Pulls protest/conflict events from ACLED API for India.
// Writes raw items to ingestion_queue for drain-queue to process.
// Does NOT embed or classify.
//
// Schedule: weekly on Monday at 02:00 via pg_cron.
// ============================================================

import { handleCors, corsHeaders } from "../_shared/cors.ts";
import { getAdminClient } from "../_shared/supabaseClient.ts";

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

Deno.serve(async (req: Request) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  try {
    const supabase = getAdminClient();
    const body = await req.json().catch(() => ({}));
    const daysPast: number = body.days_past ?? 14;

    const events = await fetchAcled(daysPast);
    let enqueued = 0;

    for (const event of events) {
      const content = `${event.event_type} in ${event.location}, India on ${event.event_date}. ${event.notes}. Actors: ${event.actor1}${event.actor2 ? `, ${event.actor2}` : ""}. Fatalities: ${event.fatalities}.`;
      const headline = `${event.event_type}: ${event.location} (${event.event_date})`;
      const sourceUrl = `https://acleddata.com/data-export-tool/?data_id=${event.data_id}`;

      const { error } = await supabase.from("ingestion_queue").insert({
        source_name: "ACLED",
        source_type: "acled",
        payload: {
          headline,
          raw_content: content,
          normalized_content: content,
          source_url: sourceUrl,
          published_at: event.event_date,
          is_direct_record: true, // Lane 1: structured event data
          default_topic_slug: "conflict",
        },
      });

      if (!error) enqueued++;
    }

    return new Response(
      JSON.stringify({ success: true, enqueued }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 },
    );
  } catch (err) {
    console.error("ingest-acled error:", err);
    return new Response(
      JSON.stringify({ success: false, error: (err as Error).message }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 },
    );
  }
});
