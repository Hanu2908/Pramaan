// ============================================================
// _shared/gemini.ts
// Gemini Embeddings helper (gemini-embedding-001, 768 dims)
// Used in Stage 4 (semantic re-ranking) of the Matching Engine.
// ============================================================

import { GoogleGenAI } from "npm:@google/genai";

let ai: GoogleGenAI | null = null;

function getAI(): GoogleGenAI {
  if (!ai) {
    const apiKey = Deno.env.get("GEMINI_API_KEY");
    if (!apiKey) throw new Error("Missing GEMINI_API_KEY environment variable");
    ai = new GoogleGenAI({ apiKey });
  }
  return ai;
}

/**
 * Generate a 768-dimension embedding using gemini-embedding-001.
 * Use taskType "RETRIEVAL_DOCUMENT" when indexing, "RETRIEVAL_QUERY" when searching.
 */
export async function generateEmbedding(
  text: string,
  taskType: "RETRIEVAL_DOCUMENT" | "RETRIEVAL_QUERY" | "SEMANTIC_SIMILARITY" =
    "RETRIEVAL_DOCUMENT",
): Promise<number[]> {
  try {
    const response = await getAI().models.embedContent({
      model: "gemini-embedding-001",
      contents: text,
      config: {
        outputDimensionality: 768, // Must match vector(768) in pgvector schema
        taskType,
      },
    });

    const values = response.embeddings?.[0]?.values ?? (response as any).embedding?.values;
    if (!values || !Array.isArray(values) || values.length === 0) {
      throw new Error(`Gemini returned invalid embedding payload: ${JSON.stringify(response)}`);
    }

    return values;
  } catch (err) {
    console.error("Embedding generation error:", (err as Error).message);
    throw err;
  }
}
