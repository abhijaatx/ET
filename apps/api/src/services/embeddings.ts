import { nvidia } from "./nvidia_client";

/**
 * High-availability embedding generation using hosted NVIDIA models.
 * Uses nv-embedqa-e5-v5 and truncates to 384 dims to match the existing DB schema
 * without requiring a migration.
 */
export async function embedText(text: string): Promise<number[]> {
  try {
    const response = await (nvidia as any).embeddings.create({
      model: "nvidia/nv-embedqa-e5-v5",
      input: text,
      encoding_format: "float",
      input_type: "passage", // Required for asymmetric models
      truncate: "END",
    });

    const embedding: number[] = response.data[0]?.embedding;
    if (!embedding) throw new Error("No embedding returned from NVIDIA");

    // Truncate to 384 dims to match existing DB vector(384) columns.
    // This avoids a DB migration while still using the hosted API.
    return embedding.slice(0, 384);
  } catch (error: any) {
    console.error(`[Embeddings] NVIDIA Error: ${error.message}. Falling back to zero-vector.`);
    return new Array(384).fill(0);
  }
}
