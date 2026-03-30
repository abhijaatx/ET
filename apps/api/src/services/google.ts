import { geminiCompletion, type GeminiCompletionOptions } from "./gemini";

export async function googleCompletion(
  systemPrompt: string,
  userPrompt: string,
  options: GeminiCompletionOptions = {}
): Promise<string> {
  console.log(`[AI] Using NVIDIA (Gemma 2 27B) for translation...`);
  return geminiCompletion(systemPrompt, userPrompt, options);
}
