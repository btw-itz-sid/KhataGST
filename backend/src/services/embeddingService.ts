// src/services/embeddingService.ts
// Gemini text embeddings — statutory knowledge base ki semantic search ke liye

const GEMINI_API_KEY = process.env.GEMINI_API_KEY || "";
const GEMINI_API_BASE = "https://generativelanguage.googleapis.com/v1beta";
const EMBEDDING_MODEL = process.env.GEMINI_EMBEDDING_MODEL || "gemini-embedding-001";

// Must match the vector(768) column in db/migrations/005_knowledge_vector.sql
export const EMBEDDING_DIMENSIONS = 768;

export type EmbeddingTask = "RETRIEVAL_DOCUMENT" | "RETRIEVAL_QUERY";

export function isEmbeddingConfigured(): boolean {
  return Boolean(GEMINI_API_KEY);
}

export async function embedText(
  text: string,
  taskType: EmbeddingTask,
  title?: string
): Promise<number[]> {
  if (!GEMINI_API_KEY) {
    throw new Error("GEMINI_API_KEY missing hai — embeddings nahi ban sakte.");
  }

  const response = await fetch(
    `${GEMINI_API_BASE}/models/${EMBEDDING_MODEL}:embedContent?key=${GEMINI_API_KEY}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: `models/${EMBEDDING_MODEL}`,
        content: { parts: [{ text }] },
        taskType,
        outputDimensionality: EMBEDDING_DIMENSIONS,
        ...(title && taskType === "RETRIEVAL_DOCUMENT" ? { title } : {}),
      }),
    }
  );

  if (!response.ok) {
    throw new Error(`Gemini embedding error (${response.status}): ${await response.text()}`);
  }

  const data = await response.json();
  const values: unknown = data?.embedding?.values;

  if (!Array.isArray(values) || values.length !== EMBEDDING_DIMENSIONS) {
    throw new Error(
      `Embedding ka size ${Array.isArray(values) ? values.length : 0} aaya, ${EMBEDDING_DIMENSIONS} chahiye tha.`
    );
  }

  return values as number[];
}

export function toPgVector(values: number[]): string {
  return `[${values.join(",")}]`;
}
