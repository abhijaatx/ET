import { env } from "../env";
import { Groq } from "groq-sdk";
import { withRetry } from "../utils/retry";

const groqClient = new Groq({ apiKey: env.GROQ_API_KEY });

// Global queue to stay under 30 RPM
let lastCallTime = 0;
const MIN_INTERVAL_MS = 2100;
const DISABLE_GROQ = false; // Re-enabled for News Navigator

export async function callGroq<T>(fn: () => Promise<T>) {
  if (DISABLE_GROQ) {
    console.log("[Groq] AI is currently disabled. Returning placeholder.");
    return "AI-generated content is temporarily unavailable." as any;
  }
  
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

export async function groqCompletion(systemPrompt: string, userPrompt: string): Promise<string> {
  if (!env.GROQ_API_KEY) throw new Error("GROQ_API_KEY is missing");
  
  const completion = await groqClient.chat.completions.create({
    model: "llama-3.1-8b-instant",
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt }
    ],
    temperature: 0.6,
    max_tokens: 4096,
    top_p: 1,
    stream: false
  });

  const content = completion.choices[0]?.message?.content;
  if (!content) throw new Error("Groq API Error: No content returned");
  return content;
}

export async function streamGroqCompletion(
  systemPrompt: string,
  userPrompt: string,
  history: { role: "user" | "assistant", content: string }[],
  onToken: (token: string) => Promise<void> | void,
  signal?: AbortSignal
) {
  if (!env.GROQ_API_KEY) throw new Error("GROQ_API_KEY is missing");

  const messages: any[] = [
    { role: "system", content: systemPrompt },
    ...history,
    { role: "user", content: userPrompt }
  ];

  const stream = await groqClient.chat.completions.create({
    model: "llama-3.1-8b-instant",
    messages,
    temperature: 0.6,
    max_tokens: 4096,
    top_p: 1,
    stream: true
  }, { signal });

  for await (const chunk of stream) {
    const content = chunk.choices[0]?.delta?.content;
    if (content) {
      await onToken(content);
    }
  }
}

