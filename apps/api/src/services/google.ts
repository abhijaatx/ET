import { groqCompletion } from "./anthropic";
import type { GeminiCompletionOptions } from "./gemini";

export async function googleCompletion(
  systemPrompt: string,
  userPrompt: string,
  options: GeminiCompletionOptions = {}
): Promise<string> {
  console.log(`[AI] Using primary Groq text model for translation...`);
  const jsonInstruction = options.responseMimeType === "application/json"
    ? "\n\nReturn only valid JSON. Do not include markdown fences or explanatory text."
    : "";

  return groqCompletion(`${systemPrompt}${jsonInstruction}`, userPrompt);
}
