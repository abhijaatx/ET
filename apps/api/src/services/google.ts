import { geminiCompletion } from "./gemini";

export async function googleCompletion(systemPrompt: string, userPrompt: string): Promise<string> {
  console.log(`[AI] Using Gemini (GoogleGenerativeAI) for translation...`);
  return geminiCompletion(systemPrompt, userPrompt);
}
