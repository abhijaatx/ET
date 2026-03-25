import { groqCompletion } from "./anthropic";

export async function googleCompletion(systemPrompt: string, userPrompt: string): Promise<string> {
  console.log(`[AI] Using Llama via Groq (as requested) for Gemini-replacement...`);
  return groqCompletion(systemPrompt, userPrompt);
}
