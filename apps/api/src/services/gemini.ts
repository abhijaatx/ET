import { env } from "../env";
import { MODEL, callNvidia, callNvidiaFast, nvidia, setPause, extractJson } from "./nvidia_client";

export type GeminiCompletionOptions = {
  preferredModels?: string[];
  responseMimeType?: "text/plain" | "application/json";
  temperature?: number;
  maxOutputTokens?: number;
};

/**
 * Normalizes messages for NVIDIA by merging the first system message into the first user message,
 * as the NVIDIA Gemma-2-27B endpoint does not support the 'system' role.
 */
function normalizeMessages(messages: any[]) {
  const result = [...messages];
  const firstSystemIndex = result.findIndex(m => m.role === "system");
  
  if (firstSystemIndex !== -1) {
    const systemContent = result[firstSystemIndex].content;
    result.splice(firstSystemIndex, 1);
    
    const firstUserIndex = result.findIndex(m => m.role === "user");
    if (firstUserIndex !== -1) {
      result[firstUserIndex].content = `Instruction: ${systemContent}\n\nTask: ${result[firstUserIndex].content}`;
    } else {
      // Add as user message if no user message exists
      result.unshift({ role: "user", content: systemContent });
    }
  }
  
  return result.filter(m => m.role !== "system");
}

/**
 * Unified geminiCompletion now uses the shared callNvidia wrapper for global rate limiting.
 */
export async function geminiCompletion(
  systemPrompt: string,
  userPrompt: string,
  options: GeminiCompletionOptions = {},
  onHeartbeat?: () => Promise<void>
): Promise<string> {
  if (!env.NVIDIA_API_KEY) throw new Error("NVIDIA_API_KEY is missing");

  // Use the fast user-facing queue (not blocked by background ingestion)
  return await callNvidiaFast(async () => {
    try {
      console.log(`[AI-Gemini] Using NVIDIA (${MODEL})...`);

      const jsonInstruction = options.responseMimeType === "application/json"
        ? "\n\nIMPORTANT: You MUST return ONLY valid JSON. No markdown, no explanation, no code blocks. Start your response with { and end with }."
        : "";

      const messages = normalizeMessages([
        { role: "system", content: systemPrompt + jsonInstruction },
        { role: "user", content: userPrompt }
      ]);

      const chatCompletion = await nvidia.chat.completions.create({
        messages: messages,
        model: MODEL,
        temperature: options.temperature ?? 0.2,
        top_p: 0.7,
        max_tokens: options.maxOutputTokens ?? 4096,
      });

      const content = chatCompletion.choices[0]?.message?.content;
      if (!content) throw new Error("NVIDIA API Error: No content returned");
      return extractJson(content);
    } catch (err: any) {
      if (err.status === 429) {
        setPause(120 * 1000);
      } else {
        console.error(`[AI-Gemini] NVIDIA ${MODEL} failed:`, err.message);
      }
      throw err;
    }
  });
}

/**
 * Unified streamGeminiCompletion now uses the shared callNvidia wrapper for global rate limiting.
 */
export async function streamGeminiCompletion(
  systemPrompt: string,
  userPrompt: string,
  history: { role: "user" | "assistant", content: string }[],
  onToken: (token: string) => Promise<void> | void,
  signal?: AbortSignal,
  onHeartbeat?: () => Promise<void>
) {
  if (!env.NVIDIA_API_KEY) throw new Error("NVIDIA_API_KEY is missing");

  // Stream also uses the fast lane for interactive use
  return await callNvidiaFast(async () => {
    try {
      console.log(`[AI-Gemini] Streaming NVIDIA (${MODEL})...`);

      const messages = normalizeMessages([
        { role: "system", content: systemPrompt },
        ...history.map(h => ({
          role: h.role as "user" | "assistant",
          content: h.content
        })),
        { role: "user", content: userPrompt }
      ]);

      const stream = await nvidia.chat.completions.create({
        messages: messages,
        model: MODEL,
        temperature: 0.2,
        top_p: 0.7,
        max_tokens: 4096,
        stream: true,
      });

      for await (const chunk of stream) {
        if (signal?.aborted) throw new Error("Aborted");
        const text = chunk.choices[0]?.delta?.content || "";
        if (text) {
          await onToken(text);
        }
      }
      return; // Success
    } catch (err: any) {
      if (err.status === 429) {
        setPause(120 * 1000);
      } else {
        console.error(`[AI-Gemini] NVIDIA stream failed:`, err.message);
      }
      throw err;
    }
  });
}
