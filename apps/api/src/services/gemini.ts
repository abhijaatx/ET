import { env } from "../env";
import { GoogleGenerativeAI } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(env.GEMINI_API_KEY || "");
const MODELS = [
  "gemini-2.5-flash",
  "gemini-2.5-flash-latest",
  "gemini-2.0-flash",
  "gemini-2.0-flash-lite",
];

export type GeminiCompletionOptions = {
  preferredModels?: string[];
  responseMimeType?: "text/plain" | "application/json";
  temperature?: number;
  maxOutputTokens?: number;
};

function cleanJson(text: string): string {
  // Extract content between first { and last }
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start !== -1 && end !== -1 && end > start) {
    return text.substring(start, end + 1);
  }
  // Fallback for markdown code blocks
  return text.replace(/```json\n?|```\n?/g, "").trim();
}

export async function geminiCompletion(
  systemPrompt: string,
  userPrompt: string,
  options: GeminiCompletionOptions = {}
): Promise<string> {
  if (!env.GEMINI_API_KEY) throw new Error("GEMINI_API_KEY is missing");

  let lastError: any = null;
  const modelsToTry = options.preferredModels?.length
    ? [...options.preferredModels, ...MODELS.filter((model) => !options.preferredModels?.includes(model))]
    : MODELS;

  for (const modelName of modelsToTry) {
    let retryCount = 0;
    const maxRetries = 2;

    while (retryCount <= maxRetries) {
      try {
        console.log(`[AI] Attempting completion with ${modelName} (Retry: ${retryCount})...`);
        const model = genAI.getGenerativeModel({ model: modelName });
        const result = await model.generateContent({
          contents: [
            { role: "user", parts: [{ text: `SYSTEM: ${systemPrompt}\n\nUSER: ${userPrompt}` }] }
          ],
          generationConfig: {
            temperature: options.temperature ?? 0.3,
            maxOutputTokens: options.maxOutputTokens ?? 4096,
            ...(options.responseMimeType ? { responseMimeType: options.responseMimeType } : {}),
          }
        });

        const content = result.response.text();
        if (!content) throw new Error("Gemini API Error: No content returned");
        return cleanJson(content);
      } catch (err: any) {
        lastError = err;
        const status = err.status || (err.response ? err.response.status : null);

        if (status === 429 && retryCount < maxRetries) {
          const waitTime = Math.pow(2, retryCount) * 2000 + Math.random() * 1000;
          console.warn(`[AI] ${modelName} rate limited (429). Retrying in ${Math.round(waitTime)}ms...`);
          await new Promise(resolve => setTimeout(resolve, waitTime));
          retryCount++;
          continue;
        }

        console.error(`[AI] ${modelName} failed:`, err.message);
        break; // Try next model
      }
    }
  }

  throw lastError || new Error("All Gemini models failed");
}

export async function streamGeminiCompletion(
  systemPrompt: string,
  userPrompt: string,
  history: { role: "user" | "assistant", content: string }[],
  onToken: (token: string) => Promise<void> | void,
  signal?: AbortSignal
) {
  if (!env.GEMINI_API_KEY) throw new Error("GEMINI_API_KEY is missing");

  let lastError: any = null;
  for (const modelName of MODELS) {
    try {
      console.log(`[AI] Attempting stream with ${modelName}...`);
      const model = genAI.getGenerativeModel({ model: modelName });
      const chat = model.startChat({
        history: [
          { role: "user", parts: [{ text: `System instruction: ${systemPrompt}` }] },
          { role: "model", parts: [{ text: "Understood. I will follow those instructions." }] },
          ...history.map(h => ({
            role: h.role === "user" ? "user" : "model" as any,
            parts: [{ text: h.content }]
          }))
        ]
      });

      const result = await chat.sendMessageStream(userPrompt);

      for await (const chunk of result.stream) {
        if (signal?.aborted) throw new Error("Aborted");
        const text = chunk.text();
        if (text) {
          await onToken(text);
        }
      }
      return; // Success
    } catch (err: any) {
      console.error(`[AI] Stream with ${modelName} failed:`, err.message);
      lastError = err;
      // Continue to next model on any error
      continue;
    }
  }
  throw lastError || new Error("All Gemini models failed for streaming");
}
