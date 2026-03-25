import { GoogleGenerativeAI } from "@google/generative-ai";
import { env } from "../env";

const genAI = new GoogleGenerativeAI(env.GEMINI_API_KEY || "");
const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

export async function googleCompletion(systemPrompt: string, userPrompt: string): Promise<string> {
  if (!env.GEMINI_API_KEY) throw new Error("GEMINI_API_KEY is missing");
  
  console.log(`[AI] Using Gemini (gemini-1.5-flash) for completion...`);

  try {
    const result = await model.generateContent({
      contents: [
        { role: "user", parts: [{ text: `SYSTEM: ${systemPrompt}\n\nUSER: ${userPrompt}` }] }
      ],
      generationConfig: {
        temperature: 0.5,
        maxOutputTokens: 4096,
      },
    });

    const response = await result.response;
    return response.text().replace(/```json\n?|```\n?/g, "").trim();
  } catch (error: any) {
    console.error("[AI] Gemini completion failed:", error);
    throw error;
  }
}
