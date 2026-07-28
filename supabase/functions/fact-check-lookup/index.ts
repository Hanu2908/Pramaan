// ============================================================
// functions/fact-check-lookup/index.ts
// Supabase Edge Function — Google Fact Check Tools API
//
// Supplementary signal for the Matching Engine.
// Queries ClaimReview data (Snopes, AFP, BBC, WaPo).
// NOTE: Skews Western coverage — used as supplementary only,
// not primary source for India-specific claims.
//
// Trigger: HTTP POST from check-claim Edge Function (optional)
// Payload: { query: string, language?: string }
// ============================================================

import { handleCors, corsHeaders } from "../_shared/cors.ts";
import { getAdminClient } from "../_shared/supabaseClient.ts";

interface ClaimReviewResult {
  text: string;
  claimant: string | null;
  claimDate: string | null;
  claimReview: Array<{
    publisher: { name: string; site: string };
    url: string;
    title: string;
    reviewDate: string | null;
    textualRating: string;
    languageCode: string;
  }>;
}

Deno.serve(async (req: Request) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  try {
    const apiKey = Deno.env.get("GOOGLE_FACTCHECK_API_KEY");
    if (!apiKey) throw new Error("Missing GOOGLE_FACTCHECK_API_KEY");

    const body = await req.json();
    const { query, language = "en-US", max_age_days = 90 } = body as {
      query: string;
      language?: string;
      max_age_days?: number;
    };

    if (!query?.trim()) throw new Error("query is required");

    const url = new URL(
      "https://factchecktools.googleapis.com/v1alpha1/claims:search",
    );
    url.searchParams.set("key", apiKey);
    url.searchParams.set("query", query);
    url.searchParams.set("languageCode", language);
    url.searchParams.set("pageSize", "10");
    url.searchParams.set("maxAgeDays", String(max_age_days));

    const res = await fetch(url.toString());
    if (!res.ok) {
      throw new Error(`Google Fact Check API error: ${res.status} ${await res.text()}`);
    }

    const data = await res.json();
    const claims: ClaimReviewResult[] = data.claims ?? [];

    // Optionally ingest verified results into evidence_items
    if (claims.length > 0) {
      const supabase = getAdminClient();
      const { data: source } = await supabase
        .from("sources")
        .select("id")
        .eq("name", "Google Fact Check")
        .single();

      if (source?.id) {
        for (const claim of claims) {
          for (const review of claim.claimReview ?? []) {
            const existing = await supabase
              .from("evidence_items")
              .select("id")
              .eq("source_url", review.url)
              .maybeSingle();

            if (!existing.data) {
              const content = `Claim: "${claim.text}". Verdict by ${review.publisher.name}: ${review.textualRating}. Published: ${review.reviewDate ?? "unknown"}.`;
              await supabase.from("evidence_items").insert({
                source_id: source.id,
                headline: claim.text.slice(0, 200),
                raw_content: content,
                normalized_content: content,
                source_url: review.url,
                published_at: review.reviewDate
                  ? new Date(review.reviewDate).toISOString()
                  : null,
                is_direct_record: false,
              });
            }
          }
        }
      }
    }

    return new Response(JSON.stringify({ claims, total: claims.length }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (err) {
    console.error("fact-check-lookup error:", err);
    return new Response(
      JSON.stringify({ error: (err as Error).message }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      },
    );
  }
});
