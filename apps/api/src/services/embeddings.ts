import { BedrockRuntimeClient, InvokeModelCommand } from "@aws-sdk/client-bedrock-runtime";
import { env } from "../env";

const bedrock = new BedrockRuntimeClient({ region: env.BEDROCK_REGION });
const EMBEDDING_DIMENSIONS = 256;
const DATABASE_DIMENSIONS = 384;

/** Generate a low-cost Titan Text Embeddings V2 vector for an article. */
export async function embedText(text: string): Promise<number[]> {
  try {
    const result = await bedrock.send(new InvokeModelCommand({
      modelId: "amazon.titan-embed-text-v2:0",
      contentType: "application/json",
      accept: "application/json",
      body: new TextEncoder().encode(JSON.stringify({
        inputText: text,
        dimensions: EMBEDDING_DIMENSIONS,
        normalize: true,
      })),
    }));

    const payload = JSON.parse(new TextDecoder().decode(result.body));
    const embedding = payload.embedding;
    if (!Array.isArray(embedding) || embedding.length !== EMBEDDING_DIMENSIONS) {
      throw new Error("Titan returned an invalid embedding");
    }

    // Keep the existing vector(384) database schema; zero padding preserves
    // the unit norm of Titan's normalized 256-dimensional embedding.
    return [...embedding, ...new Array(DATABASE_DIMENSIONS - EMBEDDING_DIMENSIONS).fill(0)];
  } catch (error: any) {
    console.error(`[Embeddings] Amazon Bedrock error: ${error.message}. Falling back to zero-vector.`);
    return new Array(DATABASE_DIMENSIONS).fill(0);
  }
}
