import { env } from "../env";
import { withRetry } from "../utils/retry";
import Groq from "groq-sdk";

const groq = new Groq({
  apiKey: env.GROQ_API_KEY
});

// Global queue to stay under AI limits (50 RPM = 1200ms per call)
let lastCallTime = 0;
const MIN_INTERVAL_MS = 1200;

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

function cleanJson(text: string): string {
  // Remove markdown code blocks if present
  return text.replace(/```json\n?|```\n?/g, "").trim();
}

const MODELS = [
  "llama-3.1-8b-instant",
  "llama-3.3-70b-versatile",
  "mixtral-8x7b-32768"
];

export async function groqCompletion(systemPrompt: string, userPrompt: string): Promise<string> {
  if (!env.GROQ_API_KEY) throw new Error("GROQ_API_KEY is missing");
  
  let lastError: any = null;

  for (const model of MODELS) {
    try {
      console.log(`[AI] Using Groq (${model}) for completion...`);
      const chatCompletion = await groq.chat.completions.create({
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt }
        ],
        model: model,
        temperature: 0.5,
        max_tokens: 4096,
      });

      return cleanJson(chatCompletion.choices[0]?.message?.content || "");
    } catch (error: any) {
      lastError = error;
      // If it's a rate limit error (429), try the next model
      if (error?.status === 429) {
        console.warn(`[AI] Model ${model} rate limited (429). Trying fallback...`);
        continue;
      }
      throw error;
    }
  }
  
  throw lastError;
}

export async function streamGroqCompletion(
  systemPrompt: string,
  userPrompt: string,
  history: { role: "user" | "assistant", content: string }[],
  onToken: (token: string) => Promise<void> | void,
  signal?: AbortSignal
) {
  if (!env.GROQ_API_KEY) throw new Error("GROQ_API_KEY is missing");

  let lastError: any = null;

  for (const model of MODELS) {
    try {
      console.log(`[AI] Using Groq (${model}) for streaming...`);

      const stream = await groq.chat.completions.create({
        messages: [
          { role: "system", content: systemPrompt },
          ...history.map(h => ({ role: h.role, content: h.content })),
          { role: "user", content: userPrompt }
        ],
        model: model,
        temperature: 0.5,
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
      lastError = error;
      if (error?.status === 429) {
        console.warn(`[AI] Model ${model} rate limited (429) during stream. Trying fallback...`);
        continue;
      }
      throw error;
    }
  }

  throw lastError;
}

