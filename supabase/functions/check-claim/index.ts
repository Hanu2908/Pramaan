// ============================================================
// functions/check-claim/index.ts
// Supabase Edge Function — 7-Stage Matching Engine
//
// Accepts a user claim (text, image URL, or audio URL).
// Runs all 7 stages: normalize → entity extract → SQL filter →
// semantic re-rank → confidence score (with REFUTED tier) → fallback → synthesize.
// ============================================================

import { handleCors, corsHeaders } from "../_shared/cors.ts";
import { getAdminClient } from "../_shared/supabaseClient.ts";
import { generateEmbedding } from "../_shared/gemini.ts";
import {
  extractEntities,
  synthesizeVerdict,
  ExtractedEntities,
} from "../_shared/groq.ts";
import { RealityDefender } from "npm:@realitydefender/realitydefender";

// ── Type definitions ─────────────────────────────────────────
type ConfidenceTier = "CONFIRMED" | "REFUTED" | "DEVELOPING" | "UNVERIFIED" | "NO_RECORD";

interface EvidenceMatch {
  id: string;
  headline: string;
  normalized_content: string;
  source_url: string;
  published_at: string;
  source_id: string;
  source_name?: string;
  source_type?: string;
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

  // For images/audio, use Groq Vision or Whisper
  if ((inputType === "image" || inputType === "audio") && mediaUrl) {
    const groqKey = Deno.env.get("GROQ_API_KEY");
    if (!groqKey) throw new Error("Missing GROQ_API_KEY for media processing");

    if (inputType === "image") {
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
      let audioBlob: Blob;
      if (mediaUrl.startsWith("data:")) {
        const parts = mediaUrl.split(",");
        const mime = parts[0].match(/:(.*?);/)?.[1] || "audio/mp3";
        const bstr = atob(parts[1]);
        const u8arr = new Uint8Array(bstr.length);
        for (let i = 0; i < bstr.length; i++) {
          u8arr[i] = bstr.charCodeAt(i);
        }
        audioBlob = new Blob([u8arr], { type: mime });
      } else {
        const audioRes = await fetch(mediaUrl);
        audioBlob = await audioRes.blob();
      }

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

    // Reality Defender check (if configured)
    const rdKey = Deno.env.get("REALITY_DEFENDER_KEY");
    if (rdKey && !mediaUrl.startsWith("data:")) {
      try {
        const realityDefender = new RealityDefender({ apiKey: rdKey });
        const result = await realityDefender.detect({ filePath: mediaUrl });
        syntheticScore = result?.score ?? null;
      } catch (rdErr) {
        console.warn("Reality Defender SDK check failed (falling back):", rdErr);
      }
    }
  }

  if (!claimText.trim()) throw new Error("No text content could be parsed from the claim input");
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

  if (entities.location) {
    query = query.ilike("normalized_content", `%${entities.location}%`);
  }
  if (entities.date_range?.start) {
    query = query.gte("published_at", entities.date_range.start);
  }
  if (entities.date_range?.end) {
    query = query.lte("published_at", entities.date_range.end);
  }
  if (entities.keywords?.length) {
    query = query.ilike("normalized_content", `%${entities.keywords[0]}%`);
  }

  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []).map((d) => ({ ...d, similarity: 0 }));
}

// ── Stage 5: Refutation & Confidence Scoring ───────────────
function scoreConfidence(
  matches: EvidenceMatch[],
  sourceMeta: Map<string, { name: string; type: string; authority_level: number }>,
): { tier: ConfidenceTier; score: number } {
  if (!matches.length) return { tier: "NO_RECORD", score: 0 };

  let weightedScore = 0;
  let hasIndependent = false;
  let hasGov = false;
  let isRefuted = false;

  const REFUTE_KEYWORDS = [
    "fake", "false", "hoax", "busted", "debunked", "misleading",
    "untrue", "bogus", "scam", "no such scheme", "baseless", "fabricated"
  ];

  for (const match of matches) {
    const meta = sourceMeta.get(match.source_id);
    const authority = meta?.authority_level ?? 5;
    const similarity = match.similarity;
    weightedScore += (similarity * authority) / 10;

    const sourceTypeName = meta?.type || match.source_type || "";
    if (sourceTypeName === "INDEPENDENT") hasIndependent = true;
    if (sourceTypeName === "GOV") hasGov = true;

    // Check if matched evidence explicitly refutes/debunks the claim
    const textToCheck = `${match.headline} ${match.normalized_content}`.toLowerCase();
    if (similarity > 0.60 && REFUTE_KEYWORDS.some(k => textToCheck.includes(k))) {
      isRefuted = true;
    }
  }

  const avgScore = weightedScore / matches.length;

  let tier: ConfidenceTier;
  if (isRefuted) {
    tier = "REFUTED";
  } else if (avgScore >= 0.75 && matches.length >= 2 && (hasIndependent || !hasGov)) {
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
                text: `Fact-check this claim using web search. Provide factual evidence from verified news outlets. Claim: "${claimText}"`,
              },
            ],
          },
        ],
        tools: [{ google_search: {} }],
        generationConfig: { temperature: 0.1, maxOutputTokens: 512 },
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
    try {
      const queryEmbedding = await generateEmbedding(claimText, "RETRIEVAL_QUERY");
      const { data: vectorMatches, error: vecErr } = await supabase.rpc(
        "match_evidence",
        {
          query_embedding: queryEmbedding,
          match_threshold: 0.55,
          match_count: 10,
        },
      );

      if (!vecErr && vectorMatches) {
        semanticMatches = vectorMatches as EvidenceMatch[];
      }
    } catch (embErr) {
      console.warn("Semantic vector search skipped (embedding failed):", embErr);
    }

    // Merge & deduplicate matches
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

    // Fetch source metadata
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
      source: m.source_name || sourceMeta.get(m.source_id)?.name || "Verified Source",
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

    const verdictSources = allMatches.slice(0, 5).map((m) => ({
      name: m.source_name || sourceMeta.get(m.source_id)?.name || "Verified Source",
      url: m.source_url,
      excerpt: m.normalized_content.slice(0, 200),
      similarity: m.similarity,
    }));

    // Save matches
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

    // Update claim check record
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
