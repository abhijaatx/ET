import { googleCompletion } from "./google";

export type VernacularBriefing = {
  story_id: string;
  headline: string;
  executive_summary: string;
  sections: { id: string; title: string; content: string; citations: string[] }[];
  suggested_questions: string[];
};

const LANGUAGE_META: Record<string, { name: string; context: string }> = {
  hi: { 
    name: "Hindi", 
    context: "Focus on North Indian retail investors, impact on daily household budgets, gold prices, and local real estate. Use high-impact, journalistic Hindi used in mainstream financial papers like ET Hindi."
  },
  ta: { 
    name: "Tamil", 
    context: "Focus on Tamil Nadu's industrial hubs, textile sectors, and the interests of the local diaspora. Address the business community in Chennai and Coimbatore with relevant analogies."
  },
  te: { 
    name: "Telugu", 
    context: "Focus on Andhra Pradesh and Telangana's pharma, agriculture, and IT sectors. Use business-heavy Telugu suitable for high-net-worth individuals in Hyderabad and Amaravati."
  },
  bn: { 
    name: "Bengali", 
    context: "Focus on West Bengal's trade, SME sectors, and historical business context. Use sophisticated, culturally resonant Bengali that appeals to the intellectual and business elite of Kolkata."
  }
};

export async function generateVernacularBriefing(params: {
  storyId: string;
  lang: string;
  englishBriefing: any; 
}) {
  const meta = LANGUAGE_META[params.lang];
  if (!meta) throw new Error(`Unsupported language: ${params.lang}`);

  const systemPrompt = `You are a specialist cultural business correspondent for The Economic Times, expert in translating complex global and Indian economic trends for a ${meta.name} audience.

Your goal is to provide a "Context-Aware Transcreation" of the provided English briefing. Do NOT perform a literal translation. 

Guidelines:
1. Culture-Awareness: Explain terms like 'Repo Rate', 'Current Account Deficit', or 'Bull Market' using analogies relevant to ${meta.name} culture if needed.
2. Local Context: ${meta.context}
3. Tone: Professional, authoritative, yet accessible. Avoid robotic translation; it should feel like it was originally written by a native ${meta.name} business journalist.
4. Structure: Maintain the original JSON structure.
5. Return ONLY valid JSON with keys:
   - story_id
   - headline (Catchy in ${meta.name})
   - executive_summary (High impact, localized)
   - sections: Array of { id, title, content (Thematically adapted), citations }
   - suggested_questions: 3 questions in ${meta.name}.`;

  const userPrompt = `English Briefing to Adapt:
${JSON.stringify(params.englishBriefing, null, 2)}

Adapt this briefing into ${meta.name}. Re-contextualize the business implications specifically for the ${meta.name} audience.`;

  const text = await googleCompletion(systemPrompt, userPrompt);
  const vernacular = JSON.parse(text);

  return vernacular as VernacularBriefing;
}
