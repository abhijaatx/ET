import { redis } from "../redis";
import { callGroq, groqCompletion } from "./anthropic";

export async function getFrame(params: {
  articleId: string;
  summary: string;
  depthTier: string;
  fast?: boolean;
}) {
  const key = `frame:${params.articleId}:${params.depthTier}`;
  const cached = await redis.get(key);
  if (cached) return cached;

  const createFrame = async () => {
    const frame = await callGroq(async () => {
      return await groqCompletion(
        "You are reframing an article lead for a user. Return one sentence only.",
        `Summary: ${params.summary}\nDepth tier: ${params.depthTier}\nReturn a single sentence lead tailored to this depth tier.`
      );
    });

    await redis.set(key, frame, "EX", 6 * 60 * 60);
    return frame;
  };

  if (params.fast) {
    createFrame().catch(err => {
      console.error("Background frame creation failed:", err.message);
    });
    return params.summary;
  }

  return createFrame();
}
