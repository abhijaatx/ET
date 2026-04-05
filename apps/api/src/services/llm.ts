import { env } from "../env";
<<<<<<< HEAD:apps/api/src/services/anthropic.ts
import { MODEL, callNvidia, nvidia, setPause, extractJson } from "./nvidia_client";

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
  
  // Also filter any remaining system messages out to be safe
  return result.filter(m => m.role !== "system");
}

/**
 * Compatibility wrapper for the groqCompletion function signature.
 */
export async function groqCompletion(systemPrompt: string, userPrompt: string, onHeartbeat?: () => Promise<void>): Promise<string> {
  if (!env.NVIDIA_API_KEY) throw new Error("NVIDIA_API_KEY is missing");
  
  return await callNvidia(async () => {
    try {
      console.log(`[AI-Anthropic] Using NVIDIA (${MODEL})...`);
      
      const messages = normalizeMessages([
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt }
      ]);

      const chatCompletion = await nvidia.chat.completions.create({
        messages: messages,
        model: MODEL,
        temperature: 0.2,
        top_p: 0.7,
        max_tokens: 4096,
      });

      return extractJson(chatCompletion.choices[0]?.message?.content || "");
    } catch (error: any) {
      if (error?.status === 429) {
        setPause(120 * 1000);
      } else {
        console.error(`[AI-Anthropic] NVIDIA ${MODEL} failed:`, error.message);
      }
      throw error;
    }
  }, onHeartbeat);
=======
import OpenAI from "openai";
import { withRetry } from "../utils/retry";

const nvidiaClient = new OpenAI({
  apiKey: env.NVIDIA_API_KEY,
  baseURL: "https://integrate.api.nvidia.com/v1"
});

const DEFAULT_MODEL = "google/gemma-2-9b-it";

// Global queue to stay under RPM limits if applicable
let lastCallTime = 0;
const MIN_INTERVAL_MS = 1000; 

export async function callGroq<T>(fn: () => Promise<T>) {
  return withRetry(async () => {
    const now = Date.now();
    const timeSinceLast = now - lastCallTime;
    
    if (timeSinceLast < MIN_INTERVAL_MS) {
      const waitTime = MIN_INTERVAL_MS - timeSinceLast + (Math.random() * 200);
      await new Promise(resolve => setTimeout(resolve, waitTime));
    }
    
    lastCallTime = Date.now();
    return await fn();
  }, { retries: 5, baseDelayMs: 1000 });
}

export async function groqCompletion(systemPrompt: string, userPrompt: string): Promise<string> {
  if (!env.NVIDIA_API_KEY) throw new Error("NVIDIA_API_KEY is missing");
  
  const completion = await nvidiaClient.chat.completions.create({
    model: DEFAULT_MODEL,
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt }
    ],
    temperature: 0.2,
    max_tokens: 4096,
    top_p: 0.7,
    stream: false
  });

  const content = completion.choices[0]?.message?.content;
  if (!content) throw new Error("NVIDIA API Error: No content returned");
  return content;
>>>>>>> 59ee7a8 (docs: overhaul README with NVIDIA Gemma, AI Video, and Two-Tower personalization details):apps/api/src/services/llm.ts
}

/**
 * Compatibility wrapper for the streamGroqCompletion function signature.
 */
export async function streamGroqCompletion(
  systemPrompt: string,
  userPrompt: string,
  history: { role: "user" | "assistant", content: string }[],
  onToken: (token: string) => Promise<void> | void,
  signal?: AbortSignal,
  onHeartbeat?: () => Promise<void>
) {
  if (!env.NVIDIA_API_KEY) throw new Error("NVIDIA_API_KEY is missing");

  return await callNvidia(async () => {
    try {
      console.log(`[AI-Anthropic] Streaming NVIDIA (${MODEL})...`);

<<<<<<< HEAD:apps/api/src/services/anthropic.ts
      const messages = normalizeMessages([
        { role: "system", content: systemPrompt },
        ...history.map(h => ({ role: h.role, content: h.content })),
        { role: "user", content: userPrompt }
      ]);
=======
  const stream = await nvidiaClient.chat.completions.create({
    model: DEFAULT_MODEL,
    messages,
    temperature: 0.2,
    max_tokens: 4096,
    top_p: 0.7,
    stream: true
  }, { signal });
>>>>>>> 59ee7a8 (docs: overhaul README with NVIDIA Gemma, AI Video, and Two-Tower personalization details):apps/api/src/services/llm.ts

      const stream = await nvidia.chat.completions.create({
        messages: messages,
        model: MODEL,
        temperature: 0.2,
        top_p: 0.7,
        max_tokens: 4096,
        stream: true,
      });

      for await (const chunk of stream) {
        if (signal?.aborted) break;
        const content = chunk.choices[0]?.delta?.content || "";
        if (content) {
          await onToken(content);
        }
      }
      return; // Success
    } catch (error: any) {
      if (error?.status === 429) {
        setPause(120 * 1000);
      } else {
        console.error(`[AI-Anthropic] Stream with NVIDIA ${MODEL} failed:`, error.message);
      }
      throw error;
    }
  }, onHeartbeat);
}
<<<<<<< HEAD:apps/api/src/services/anthropic.ts

// Preserve export names for consumers
export { callNvidia as callGroq };
=======
>>>>>>> 59ee7a8 (docs: overhaul README with NVIDIA Gemma, AI Video, and Two-Tower personalization details):apps/api/src/services/llm.ts
