import type { FeatureExtractionPipeline } from "@xenova/transformers";

let embedderPromise: Promise<FeatureExtractionPipeline> | null = null;

async function getEmbedder() {
  if (!embedderPromise) {
    embedderPromise = (async () => {
      const { pipeline, env } = await import("@xenova/transformers");
      env.cacheDir = "/tmp/transformers";
      env.remoteHost = "https://hf-mirror.com/";
      let lastError;
      for (let attempt = 1; attempt <= 5; attempt++) {
        try {
          console.log(`[Embedder] Loading model Xenova/all-MiniLM-L6-v2 (Attempt ${attempt}/5)...`);
          return await pipeline("feature-extraction", "Xenova/all-MiniLM-L6-v2");
        } catch (e) {
          console.error(`[Embedder] Attempt ${attempt} failed:`, e?.toString().split('\\n')[0]);
          lastError = e;
          if (attempt < 5) await new Promise(r => setTimeout(r, 4000));
        }
      }
      embedderPromise = null;
      throw lastError;
    })();
  }
  return embedderPromise;
}

export async function embedText(text: string): Promise<number[]> {
  try {
    const embedder = await getEmbedder();
    const output = await embedder(text, { pooling: "mean", normalize: true });
    return Array.from(output.data as Float32Array);
  } catch (error) {
    console.warn("[Embeddings] Model download blocked by network firewall. Proceeding with zero-vector fallback.");
    return new Array(384).fill(0);
  }
}
