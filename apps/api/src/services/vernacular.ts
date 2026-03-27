import { googleCompletion } from "./google";

export type VernacularBriefing = {
  story_id: string;
  headline: string;
  executive_summary: string;
  sections: { id: string; title: string; content: string; citations: string[] }[];
  suggested_questions: string[];
};

export type VernacularStoryArc = {
  story_id: string;
  timeline: { date: string; event: string; article_id: string; impact_level: "low" | "medium" | "high" }[];
  players: { name: string; role: string; stance: string; influence_score: number }[];
  contrarian_views: { perspective: string; source_article_id: string; strength: "moderate" | "significant" }[];
  predictions: { scenario: string; probability: string; trigger: string }[];
  labels: { 
    timeline_title: string; 
    players_title: string; 
    contrarian_title: string; 
    outlook_title: string;
    impact_suffix: string;
    trigger_label: string;
  };
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

export async function generateVernacularStoryArc(params: {
  storyId: string;
  lang: string;
  englishArc: any;
}) {
  const meta = LANGUAGE_META[params.lang];
  if (!meta) throw new Error(`Unsupported language: ${params.lang}`);

  const systemPrompt = `You are a specialist cultural business correspondent for The Economic Times, expert in translating complex global and Indian economic trends for a ${meta.name} audience.

Your goal is to provide a "Context-Aware Transcreation" of the provided English Story Arc. 

Guidelines:
1. Culture-Awareness: Adapt the business implications for the ${meta.name} context.
2. Local Context: ${meta.context}
3. Structure: Maintain the original JSON structure.
4. Language: Translate ALL text values into ${meta.name}.
5. Labels: Provide translated labels for the UI.
6. Return ONLY valid JSON with keys:
   - story_id
   - timeline: Array of { date, event (translated), article_id, impact_level }
   - players: Array of { name, role (translated), stance (translated), influence_score }
   - contrarian_views: Array of { perspective (translated), source_article_id, strength }
   - predictions: Array of { scenario (translated), probability (translated), trigger (translated) }
   - labels: { timeline_title, players_title, contrarian_title, outlook_title, impact_suffix, trigger_label }`;

  const userPrompt = `English Story Arc to Adapt:
${JSON.stringify(params.englishArc, null, 2)}

Adapt this story arc into ${meta.name}.`;

  const text = await googleCompletion(systemPrompt, userPrompt);
  const vernacular = JSON.parse(text);

  return vernacular as VernacularStoryArc;
}

export async function translateArticle(params: {
  lang: string;
  title: string;
  content: string;
}) {
  const meta = LANGUAGE_META[params.lang];
  if (!meta) throw new Error(`Unsupported language: ${params.lang}`);

  const systemPrompt = `You are a professional business translator for The Economic Times. 
Translate the following article into ${meta.name}.
Maintain a professional, journalistic tone. 
Ensure financial terms are accurately translated or explained in context.
Return the translated title and content.
Return ONLY valid JSON with keys: title, content.`;

  const userPrompt = `Title: ${params.title}\n\nContent: ${params.content}`;

  const text = await googleCompletion(systemPrompt, userPrompt);
  const vernacular = JSON.parse(text);

  return vernacular as { title: string; content: string };
}
