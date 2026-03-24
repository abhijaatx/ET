import { env } from "../env";
import { geminiCompletion, streamGeminiCompletion } from "./gemini";
import { withRetry } from "../utils/retry";

// Global queue to stay under AI limits
let lastCallTime = 0;
const MIN_INTERVAL_MS = 3000;

export async function callGroq<T>(fn: () => Promise<T>) {
  return withRetry(async () => {
    const now = Date.now();
    const timeSinceLast = now - lastCallTime;
    
    if (timeSinceLast < MIN_INTERVAL_MS) {
      const waitTime = MIN_INTERVAL_MS - timeSinceLast + (Math.random() * 500);
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

export async function groqCompletion(systemPrompt: string, userPrompt: string): Promise<string> {
  // Now using Gemini only as requested
  if (!env.GEMINI_API_KEY) throw new Error("GEMINI_API_KEY is missing");
  console.log("[AI] Using Gemini for completion...");
  const content = await geminiCompletion(systemPrompt, userPrompt);
  return cleanJson(content);
}

export async function streamGroqCompletion(
  systemPrompt: string,
  userPrompt: string,
  history: { role: "user" | "assistant", content: string }[],
  onToken: (token: string) => Promise<void> | void,
  signal?: AbortSignal
) {
  // Now using Gemini only as requested
  if (!env.GEMINI_API_KEY) throw new Error("GEMINI_API_KEY is missing");
  console.log("[AI] Using Gemini for streaming...");
  return await streamGeminiCompletion(systemPrompt, userPrompt, history, onToken, signal);
}

