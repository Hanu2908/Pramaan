// ============================================================
// functions/check-claim/index.ts
// Supabase Edge Function — 7-Stage Matching Engine
//
// Accepts a user claim (text, image URL, or audio URL).
// Runs all 7 stages: normalize → entity extract → SQL filter →
// semantic re-rank → confidence score → fallback → synthesize.
//
// Trigger: HTTP POST from React frontend
// Payload: { text?: string, media_url?: string, input_type?: 'text'|'image'|'audio' }
// ============================================================

import { handleCors, corsHeaders } from "../_shared/cors.ts";
import { getAdminClient } from "../_shared/supabaseClient.ts";
import { generateEmbedding } from "../_shared/gemini.ts";
import {
  extractEntities,
  synthesizeVerdict,
  ExtractedEntities,
} from "../_shared/groq.ts";

// ── Type definitions ─────────────────────────────────────────
type ConfidenceTier = "CONFIRMED" | "DEVELOPING" | "UNVERIFIED" | "NO_RECORD";

interface EvidenceMatch {
  id: string;
  headline: string;
  normalized_content: string;
  source_url: string;
  published_at: string;
  source_id: string;
  similarity: number;
}

// ── Stage 1: Input Normalization ─────────────────────────────
async function normalizeInput(
  text: string | null,
  mediaUrl: string | null,
  inputType: "text" | "image" | "audio",
): Promise<{ claimText: string; syntheticScore: number | null }> {
  let claimText = text ?? "";
  let syntheticScore: number | null = null;

  // For images/audio, use Groq Vision or Whisper (via Groq multimodal)
  if ((inputType === "image" || inputType === "audio") && mediaUrl) {
    const groqKey = Deno.env.get("GROQ_API_KEY");
    if (!groqKey) throw new Error("Missing GROQ_API_KEY for media processing");

    if (inputType === "image") {
      // Groq Vision: extract text from image
      const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${groqKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "meta-llama/llama-4-scout-17b-16e-instruct",
          messages: [
            {
              role: "user",
              content: [
                {
                  type: "text",
                  text: "Extract all text from this image. Return ONLY the extracted text, nothing else.",
                },
                { type: "image_url", image_url: { url: mediaUrl } },
              ],
            },
          ],
          max_tokens: 1024,
        }),
      });
      const data = await res.json();
      claimText = data.choices?.[0]?.message?.content ?? "";
    } else if (inputType === "audio") {
      // Groq Whisper: transcribe audio
      const audioRes = await fetch(mediaUrl);
      const audioBlob = await audioRes.blob();

      const formData = new FormData();
      formData.append("file", audioBlob, "audio.mp3");
      formData.append("model", "whisper-large-v3-turbo");
      formData.append("language", "en");

      const res = await fetch("https://api.groq.com/openai/v1/audio/transcriptions", {
        method: "POST",
        headers: { Authorization: `Bearer ${groqKey}` },
        body: formData,
      });
      const data = await res.json();
      claimText = data.text ?? "";
    }

    // Reality Defender: synthetic media detection (50/month limit)
    const rdKey = Deno.env.get("REALITY_DEFENDER_KEY");
    if (rdKey) {
      try {
        const presignRes = await fetch(
          "https://api.prd.realitydefender.xyz/api/files/aws-presigned",
          {
            method: "POST",
            headers: {
              "X-API-KEY": rdKey,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ fileName: `suspect.${inputType}` }),
          },
        );
        if (presignRes.ok) {
          const { requestId } = await presignRes.json();
          // Poll for result (simplified — in production use webhook)
          await new Promise((r) => setTimeout(r, 3000));
          const resultRes = await fetch(
            `https://api.prd.realitydefender.xyz/api/files/request/${requestId}`,
            { headers: { "X-API-KEY": rdKey } },
          );
          if (resultRes.ok) {
            const result = await resultRes.json();
            syntheticScore = result.score ?? null;
          }
        }
      } catch (rdErr) {
        console.warn("Reality Defender check failed (non-fatal):", rdErr);
      }
    }
  }

  if (!claimText.trim()) throw new Error("No claim text could be extracted");
  return { claimText, syntheticScore };
}

// ── Stage 3: Structured SQL Filter ──────────────────────────
async function sqlFilter(
  supabase: ReturnType<typeof getAdminClient>,
  entities: ExtractedEntities,
): Promise<EvidenceMatch[]> {
  let query = supabase
    .from("evidence_items")
    .select(
      "id, headline, normalized_content, source_url, published_at, source_id, entities",
    )
    .eq("is_archived", false)
    .limit(50);

  // Filter by location if extracted
  if (entities.location) {
    query = query.ilike("normalized_content", `%${entities.location}%`);
  }

  // Filter by date range if extracted
  if (entities.date_range?.start) {
    query = query.gte("published_at", entities.date_range.start);
  }
  if (entities.date_range?.end) {
    query = query.lte("published_at", entities.date_range.end);
  }

  // Filter by keyword (first most specific keyword)
  if (entities.keywords?.length) {
    query = query.ilike(
      "normalized_content",
      `%${entities.keywords[0]}%`,
    );
  }

  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []).map((d) => ({ ...d, similarity: 0 }));
}

// ── Stage 5: Confidence Scoring ──────────────────────────────
function scoreConfidence(
  matches: EvidenceMatch[],
  sourceMeta: Map<string, { name: string; type: string; authority_level: number }>,
): { tier: ConfidenceTier; score: number } {
  if (!matches.length) return { tier: "NO_RECORD", score: 0 };

  // Calculate weighted score
  let weightedScore = 0;
  let hasIndependent = false;
  let hasGov = false;

  for (const match of matches) {
    const meta = sourceMeta.get(match.source_id);
    const authority = meta?.authority_level ?? 5;
    const similarity = match.similarity;
    weightedScore += (similarity * authority) / 10;

    if (meta?.type === "INDEPENDENT") hasIndependent = true;
    if (meta?.type === "GOV") hasGov = true;
  }

  // Neutrality rule: Gov-only claims require independent corroboration
  // for CONFIRMED tier (enforces Alt News / Factly agreement requirement)
  const avgScore = weightedScore / matches.length;

  let tier: ConfidenceTier;
  if (avgScore >= 0.75 && matches.length >= 2 && (hasIndependent || !hasGov)) {
    tier = "CONFIRMED";
  } else if (avgScore >= 0.55 && matches.length >= 1) {
    tier = "DEVELOPING";
  } else if (matches.length > 0) {
    tier = "UNVERIFIED";
  } else {
    tier = "NO_RECORD";
  }

  return { tier, score: Math.min(avgScore, 1.0) };
}

// ── Stage 6: Gemini Web Grounding Fallback ───────────────────
async function webGroundingFallback(claimText: string): Promise<string> {
  const apiKey = Deno.env.get("GEMINI_API_KEY");
  if (!apiKey) throw new Error("Missing GEMINI_API_KEY for web grounding");

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              {
                text: `Fact-check this claim using web search. Provide only factual information from credible sources. Claim: "${claimText}"`,
              },
            ],
          },
        ],
        tools: [{ google_search: {} }],
        generationConfig: {
          temperature: 0.1,
          maxOutputTokens: 512,
        },
      }),
    },
  );

  if (!res.ok) throw new Error(`Gemini grounding error: ${res.status}`);
  const data = await res.json();
  return (
    data.candidates?.[0]?.content?.parts?.[0]?.text ??
    "No grounding results available."
  );
}

// ── Main Handler ─────────────────────────────────────────────
Deno.serve(async (req: Request) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  const supabase = getAdminClient();
  let claimCheckId: string | null = null;

  try {
    const body = await req.json();
    const {
      text = null,
      media_url = null,
      input_type = "text",
    } = body as { text?: string; media_url?: string; input_type?: string };

    if (!text && !media_url) {
      throw new Error("Provide either 'text' or 'media_url'");
    }

    // Create pending claim_check record
    const { data: claimRecord, error: createErr } = await supabase
      .from("claim_checks")
      .insert({
        user_input: text ?? media_url ?? "",
        input_type,
        media_url,
        status: "processing",
      })
      .select("id")
      .single();

    if (createErr || !claimRecord) throw createErr ?? new Error("Failed to create claim record");
    claimCheckId = claimRecord.id;

    // ── Stage 1: Normalize ───────────────────────────────────
    const { claimText, syntheticScore } = await normalizeInput(
      text,
      media_url,
      input_type as "text" | "image" | "audio",
    );

    await supabase
      .from("claim_checks")
      .update({
        normalized_text: claimText,
        synthetic_score: syntheticScore,
        is_synthetic: syntheticScore !== null ? syntheticScore > 0.7 : null,
      })
      .eq("id", claimCheckId);

    // ── Stage 2: Entity Extraction ───────────────────────────
    const entities = await extractEntities(claimText);
    await supabase
      .from("claim_checks")
      .update({ extracted_entities: entities })
      .eq("id", claimCheckId);

    // ── Stage 3: Structured SQL Filter ──────────────────────
    const sqlMatches = await sqlFilter(supabase, entities);

    // ── Stage 4: Semantic Re-ranking ─────────────────────────
    let semanticMatches: EvidenceMatch[] = [];
    if (sqlMatches.length > 0 || true) {
      // Always run semantic search for best results
      const queryEmbedding = await generateEmbedding(claimText, "RETRIEVAL_QUERY");

      const { data: vectorMatches, error: vecErr } = await supabase.rpc(
        "match_evidence",
        {
          query_embedding: queryEmbedding,
          match_threshold: 0.60,
          match_count: 10,
        },
      );

      if (!vecErr && vectorMatches) {
        semanticMatches = vectorMatches as EvidenceMatch[];
      }
    }

    // Merge and deduplicate matches, preferring higher similarity
    const matchMap = new Map<string, EvidenceMatch>();
    for (const m of [...sqlMatches, ...semanticMatches]) {
      const existing = matchMap.get(m.id);
      if (!existing || m.similarity > existing.similarity) {
        matchMap.set(m.id, m);
      }
    }
    const allMatches = Array.from(matchMap.values())
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, 10);

    // Fetch source metadata for confidence scoring
    const sourceIds = [...new Set(allMatches.map((m) => m.source_id))];
    const { data: sources } = await supabase
      .from("sources")
      .select("id, name, type, authority_level")
      .in("id", sourceIds);

    const sourceMeta = new Map(
      (sources ?? []).map((s) => [s.id, s]),
    );

    // ── Stage 5: Confidence Scoring ──────────────────────────
    const { tier, score } = scoreConfidence(allMatches, sourceMeta);

    // ── Stage 6: Fallback (if no matches) ───────────────────
    let usedWebGrounding = false;
    let groundingNote = "";

    if (allMatches.length === 0) {
      try {
        groundingNote = await webGroundingFallback(claimText);
        usedWebGrounding = true;
      } catch (gErr) {
        console.warn("Web grounding fallback failed:", gErr);
        groundingNote = "Web search unavailable.";
      }
    }

    // ── Stage 7: Constrained Synthesis ──────────────────────
    const evidenceForSynthesis = allMatches.slice(0, 5).map((m) => ({
      source: sourceMeta.get(m.source_id)?.name ?? "Unknown",
      url: m.source_url,
      content: m.normalized_content,
      publishedAt: m.published_at,
    }));

    if (usedWebGrounding && groundingNote) {
      evidenceForSynthesis.push({
        source: "Gemini Web Search (UNOFFICIAL)",
        url: "https://google.com",
        content: groundingNote,
        publishedAt: new Date().toISOString(),
      });
    }

    const verdict = await synthesizeVerdict({
      userClaim: claimText,
      matchedEvidence: evidenceForSynthesis,
      confidenceTier: tier,
      usedWebGrounding,
    });

    // Prepare source citations
    const verdictSources = allMatches.slice(0, 5).map((m) => ({
      name: sourceMeta.get(m.source_id)?.name ?? "Unknown",
      url: m.source_url,
      excerpt: m.normalized_content.slice(0, 200),
      similarity: m.similarity,
    }));

    // Save matches to evidence_matches table
    if (allMatches.length > 0) {
      await supabase.from("evidence_matches").upsert(
        allMatches.map((m) => ({
          claim_check_id: claimCheckId,
          evidence_item_id: m.id,
          similarity_score: m.similarity,
          match_stage: m.similarity > 0 ? "semantic" : "sql_filter",
        })),
      );
    }

    // Final update to claim_checks
    await supabase
      .from("claim_checks")
      .update({
        confidence_tier: tier,
        confidence_score: score,
        used_web_grounding: usedWebGrounding,
        web_grounding_note: groundingNote || null,
        synthesized_verdict: verdict,
        verdict_sources: verdictSources,
        status: "complete",
        completed_at: new Date().toISOString(),
      })
      .eq("id", claimCheckId);

    return new Response(
      JSON.stringify({
        id: claimCheckId,
        tier,
        score,
        verdict,
        sources: verdictSources,
        synthetic_score: syntheticScore,
        used_web_grounding: usedWebGrounding,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      },
    );
  } catch (err) {
    console.error("check-claim error:", err);

    // Mark claim as errored
    if (claimCheckId) {
      await getAdminClient()
        .from("claim_checks")
        .update({
          status: "error",
          error_message: (err as Error).message,
        })
        .eq("id", claimCheckId);
    }

    return new Response(
      JSON.stringify({ error: (err as Error).message }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      },
    );
  }
});
