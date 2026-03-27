import { googleCompletion } from "./google";

export type VernacularBriefing = {
  story_id: string;
  headline: string;
  generated_at?: string;
  depth_tier?: string;
  summary?: { text: string; citations: string[] };
  executive_summary: string;
  sections: { id: string; title: string; content: string; citations: string[] }[];
  key_entities?: { name: string; type: string; role: string }[];
  suggested_questions: string[];
  source_articles?: { id: string; title: string; url: string; content: string; author: string | null; authorId: string | null; published_at: string | null }[];
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

const GEMINI_TRANSLATION_OPTIONS = {
  preferredModels: ["gemini-2.5-flash", "gemini-2.5-flash-latest"],
  responseMimeType: "application/json" as const,
  temperature: 0.2,
  maxOutputTokens: 4096,
};

function parseModelJson<T>(text: string): T {
  return JSON.parse(text) as T;
}

function normalizeStringArray(value: unknown, fallback: string[] = []): string[] {
  if (!Array.isArray(value)) {
    return fallback;
  }

  return value.filter((item): item is string => typeof item === "string");
}

function normalizeBriefing(
  englishBriefing: any,
  translated: Partial<VernacularBriefing>
): VernacularBriefing {
  const sourceSections = Array.isArray(englishBriefing?.sections) ? englishBriefing.sections : [];
  const translatedSections = Array.isArray(translated?.sections) ? translated.sections : [];
  const translatedEntities = Array.isArray(translated?.key_entities) ? translated.key_entities : [];
  const sourceEntities = Array.isArray(englishBriefing?.key_entities) ? englishBriefing.key_entities : [];

  return {
    story_id: translated.story_id ?? englishBriefing?.story_id ?? "",
    headline: translated.headline ?? englishBriefing?.headline ?? "",
    generated_at: englishBriefing?.generated_at,
    depth_tier: englishBriefing?.depth_tier,
    summary: englishBriefing?.summary
      ? {
          text: translated.summary?.text ?? englishBriefing.summary.text ?? "",
          citations: normalizeStringArray(translated.summary?.citations, englishBriefing.summary.citations ?? []),
        }
      : undefined,
    executive_summary: translated.executive_summary ?? englishBriefing?.executive_summary ?? "",
    sections: sourceSections.map((section: any, index: number) => ({
      id: section.id,
      title: translatedSections[index]?.title ?? section.title,
      content: translatedSections[index]?.content ?? section.content,
      citations: normalizeStringArray(translatedSections[index]?.citations, section.citations ?? []),
    })),
    key_entities: sourceEntities.map((entity: any, index: number) => ({
      name: entity.name,
      type: entity.type,
      role: translatedEntities[index]?.role ?? entity.role,
    })),
    suggested_questions: normalizeStringArray(
      translated.suggested_questions,
      englishBriefing?.suggested_questions ?? []
    ),
    source_articles: englishBriefing?.source_articles ?? [],
  };
}

function normalizeStoryArc(
  englishArc: any,
  translated: Partial<VernacularStoryArc>
): VernacularStoryArc {
  const sourceTimeline = Array.isArray(englishArc?.timeline) ? englishArc.timeline : [];
  const translatedTimeline = Array.isArray(translated?.timeline) ? translated.timeline : [];
  const sourcePlayers = Array.isArray(englishArc?.players) ? englishArc.players : [];
  const translatedPlayers = Array.isArray(translated?.players) ? translated.players : [];
  const sourceViews = Array.isArray(englishArc?.contrarian_views) ? englishArc.contrarian_views : [];
  const translatedViews = Array.isArray(translated?.contrarian_views) ? translated.contrarian_views : [];
  const sourcePredictions = Array.isArray(englishArc?.predictions) ? englishArc.predictions : [];
  const translatedPredictions = Array.isArray(translated?.predictions) ? translated.predictions : [];

  return {
    story_id: translated.story_id ?? englishArc?.story_id ?? "",
    timeline: sourceTimeline.map((item: any, index: number) => ({
      date: item.date,
      event: translatedTimeline[index]?.event ?? item.event,
      article_id: item.article_id,
      impact_level: translatedTimeline[index]?.impact_level ?? item.impact_level,
    })),
    players: sourcePlayers.map((item: any, index: number) => ({
      name: item.name,
      role: translatedPlayers[index]?.role ?? item.role,
      stance: translatedPlayers[index]?.stance ?? item.stance,
      influence_score: translatedPlayers[index]?.influence_score ?? item.influence_score,
    })),
    contrarian_views: sourceViews.map((item: any, index: number) => ({
      perspective: translatedViews[index]?.perspective ?? item.perspective,
      source_article_id: item.source_article_id,
      strength: translatedViews[index]?.strength ?? item.strength,
    })),
    predictions: sourcePredictions.map((item: any, index: number) => ({
      scenario: translatedPredictions[index]?.scenario ?? item.scenario,
      probability: translatedPredictions[index]?.probability ?? item.probability,
      trigger: translatedPredictions[index]?.trigger ?? item.trigger,
    })),
    labels: {
      timeline_title: translated.labels?.timeline_title ?? englishArc?.labels?.timeline_title ?? "Timeline",
      players_title: translated.labels?.players_title ?? englishArc?.labels?.players_title ?? "Key Players",
      contrarian_title: translated.labels?.contrarian_title ?? englishArc?.labels?.contrarian_title ?? "Contrarian Views",
      outlook_title: translated.labels?.outlook_title ?? englishArc?.labels?.outlook_title ?? "Outlook",
      impact_suffix: translated.labels?.impact_suffix ?? englishArc?.labels?.impact_suffix ?? "impact",
      trigger_label: translated.labels?.trigger_label ?? englishArc?.labels?.trigger_label ?? "Trigger",
    },
  };
}

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
4. Structure: Maintain the original JSON structure and keep array lengths aligned with the source.
5. Language: Translate all reader-facing text to ${meta.name}, but preserve ids, URLs, timestamps, and citation ids exactly.
6. Return ONLY valid JSON with keys:
   - story_id
   - headline (Catchy in ${meta.name})
   - summary: { text, citations }
   - executive_summary (High impact, localized)
   - sections: Array of { id, title, content (Thematically adapted), citations }
   - key_entities: Array of { name, type, role }
   - suggested_questions: 3 questions in ${meta.name}.`;

  const userPrompt = `English Briefing to Adapt:
${JSON.stringify(params.englishBriefing, null, 2)}

Adapt this briefing into ${meta.name}. Re-contextualize the business implications specifically for the ${meta.name} audience.`;

  const text = await googleCompletion(systemPrompt, userPrompt, GEMINI_TRANSLATION_OPTIONS);
  const vernacular = parseModelJson<Partial<VernacularBriefing>>(text);

  return normalizeBriefing(params.englishBriefing, vernacular);
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

  const text = await googleCompletion(systemPrompt, userPrompt, GEMINI_TRANSLATION_OPTIONS);
  const vernacular = parseModelJson<Partial<VernacularStoryArc>>(text);

  return normalizeStoryArc(params.englishArc, vernacular);
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

  const text = await googleCompletion(systemPrompt, userPrompt, GEMINI_TRANSLATION_OPTIONS);
  const vernacular = parseModelJson<{ title?: string; content?: string }>(text);

  return {
    title: vernacular.title ?? params.title,
    content: vernacular.content ?? params.content,
  };
}
