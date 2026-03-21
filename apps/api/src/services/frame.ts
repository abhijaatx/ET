import { redis } from "../redis";
import { callAnthropic, anthropic } from "./anthropic";

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
    const frame = await callAnthropic(async () => {
      const message = await anthropic.messages.create({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 80,
        temperature: 0.4,
        system:
          "You are reframing an article lead for a user. Return one sentence only.",
        messages: [
          {
            role: "user",
            content: `Summary: ${params.summary}\nDepth tier: ${params.depthTier}\nReturn a single sentence lead tailored to this depth tier.`
          }
        ]
      });

      return message.content
        .map((block) => (block.type === "text" ? block.text : ""))
        .join("")
        .trim();
    });

    await redis.set(key, frame, "EX", 6 * 60 * 60);
    return frame;
  };

  if (params.fast) {
    void createFrame();
    return params.summary;
  }

  return createFrame();
}
