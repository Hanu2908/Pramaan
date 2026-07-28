// ============================================================
// _shared/groq.ts
// Groq LLM helpers for entity extraction (Stage 2) and
// constrained synthesis (Stage 7) of the Matching Engine.
// Model: llama-3.3-70b-versatile (free tier: 1,000 RPD)
// ============================================================

import Groq from "npm:groq-sdk";

let groqClient: Groq | null = null;

function getGroq(): Groq {
  if (!groqClient) {
    const apiKey = Deno.env.get("GROQ_API_KEY");
    if (!apiKey) throw new Error("Missing GROQ_API_KEY");
    groqClient = new Groq({ apiKey });
  }
  return groqClient;
}

// ── Entity schema ────────────────────────────────────────────
export interface ExtractedEntities {
  location: string;
  date_range: { start: string | null; end: string | null };
  actors: string[];
  keywords: string[];
  topic_slug: string; // one of: government, protests, elections, international, science-tech, health, economy, disaster
}

// ── Stage 2: Entity Extraction ───────────────────────────────
/**
 * Extracts structured entities from a claim/news text.
 * Returns a strict JSON object matching ExtractedEntities.
 * No hallucination — model is constrained to only return what is in the text.
 */
export async function extractEntities(
  text: string,
): Promise<ExtractedEntities> {
  const completion = await getGroq().chat.completions.create({
    model: "llama-3.3-70b-versatile",
    messages: [
      {
        role: "system",
        content: `You are a precise entity extraction engine for an Indian news fact-checking system.
Extract ONLY entities that are explicitly present in the text. Do not infer or hallucinate.
Respond with ONLY valid JSON matching this exact schema:
{
  "location": "string (city, state, or country. Use 'India' if national scope. Empty string if unknown)",
  "date_range": { "start": "YYYY-MM-DD or null", "end": "YYYY-MM-DD or null" },
  "actors": ["array of named persons, organizations, or government bodies mentioned"],
  "keywords": ["3-7 key factual terms that describe the core claim"],
  "topic_slug": "one of: government, protests, elections, international, science-tech, health, economy, disaster"
}`,
      },
      {
        role: "user",
        content: `Extract entities from this text:\n\n${text.slice(0, 3000)}`,
      },
    ],
    response_format: { type: "json_object" },
    temperature: 0.0, // Fully deterministic
    max_tokens: 512,
  });

  const raw = completion.choices[0]?.message?.content ?? "{}";
  return JSON.parse(raw) as ExtractedEntities;
}

// ── Stage 7: Constrained Synthesis ───────────────────────────
export interface SynthesisInput {
  userClaim: string;
  matchedEvidence: Array<{
    source: string;
    url: string;
    content: string;
    publishedAt: string;
  }>;
  confidenceTier: "CONFIRMED" | "DEVELOPING" | "UNVERIFIED" | "NO_RECORD";
  usedWebGrounding: boolean;
}

/**
 * Synthesizes a plain-language verdict from ONLY the retrieved evidence.
 * Strict system prompt prevents hallucination outside retrieved context.
 * Must cite sources by name. Must not state anything unsupported.
 */
export async function synthesizeVerdict(
  input: SynthesisInput,
): Promise<string> {
  const evidenceBlock = input.matchedEvidence
    .map(
      (e, i) =>
        `[${i + 1}] Source: ${e.source} (${e.publishedAt})\nURL: ${e.url}\nContent: ${e.content.slice(0, 500)}`,
    )
    .join("\n\n---\n\n");

  const groundingNote = input.usedWebGrounding
    ? "\n\n[NOTE: Supplementary web search results were used as a fallback. These are labeled unofficial.]"
    : "";

  const completion = await getGroq().chat.completions.create({
    model: "llama-3.3-70b-versatile",
    messages: [
      {
        role: "system",
        content: `You are Pramaan's fact-checking synthesis engine for an Indian news verification system.

STRICT RULES — violations are unacceptable:
1. Only summarize information explicitly present in the provided evidence. Do NOT use any outside knowledge.
2. Cite sources by name (e.g., "According to Alt News..." or "PIB states...").
3. Never assert something as fact if the evidence only partially supports it.
4. Be neutral. Do not editorialize or take sides.
5. Keep the response under 200 words.
6. If the tier is NO_RECORD, clearly state no matching evidence was found.
7. If webGrounding was used, note it is "unofficial" and "unverified by our database".
8. End with a one-line "Verdict: [CONFIRMED | DEVELOPING | UNVERIFIED | NO_RECORD]".`,
      },
      {
        role: "user",
        content: `Claim to verify: "${input.userClaim}"

Confidence Tier: ${input.confidenceTier}
${groundingNote}

Evidence retrieved from our verified database:

${evidenceBlock || "No evidence found in database."}

Write a concise, sourced verdict based ONLY on the above evidence.`,
      },
    ],
    temperature: 0.1,
    max_tokens: 512,
  });

  return completion.choices[0]?.message?.content ?? "Unable to synthesize verdict.";
}
