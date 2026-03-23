import { callGroq, groqCompletion } from "./anthropic";
import fs from "fs/promises";
import path from "path";

const DATA_DIR = path.join(process.cwd(), "data", "story_arcs");

export type StoryArc = {
  story_id: string;
  timeline: { date: string; event: string; article_id: string; impact_level: "low" | "medium" | "high" }[];
  players: { name: string; role: string; stance: string; influence_score: number }[];
  sentiment_matrix: {
    narrative: { date: string; score: number; label: string }[];
    market: { date: string; score: number; label: string }[];
  };
  contrarian_views: { perspective: string; source_article_id: string; strength: "moderate" | "significant" }[];
  predictions: { scenario: string; probability: string; trigger: string }[];
};

export async function generateStoryArc(params: {
  storyId: string;
  articles: { id: string; title: string; summary: string; publishedAt: Date | null }[];
}) {
  const cachePath = path.join(DATA_DIR, `${params.storyId}.v2.json`);
  try {
    const cached = await fs.readFile(cachePath, "utf-8");
    return JSON.parse(cached);
  } catch (err) {}

  const context = params.articles
    .map(a => `[Article: ${a.id}, Date: ${a.publishedAt?.toISOString() ?? "N/A"}]\nTitle: ${a.title}\nSummary: ${a.summary}`)
    .join("\n\n---\n\n");

  const systemPrompt = `You are a Senior Strategic Financial Analyst. Build a dual-layered "Story Arc" narrative.
Analyze the provided articles to extract:
1. A chronological timeline of high-impact events.
2. Key players and their evolving power dynamics.
3. A DUAL sentiment trajectory:
   - Narrative Sentiment: The public tone, media framing, and general emotion (-1 to 1).
   - Market Sentiment: Financial reaction, analyst skepticism, or investor confidence (-1 to 1).
4. Contrarian perspectives that challenge the consensus.
5. High-probability future scenarios with specific triggers.

Ensure the sentiment points are granular and reflect shifts in the narrative.
Return ONLY valid JSON.`;

  const userPrompt = `Articles:
${context}

Return JSON with schema:
{
  "story_id": "${params.storyId}",
  "timeline": [{"date": "ISO8601", "event": "string", "article_id": "string", "impact_level": "low|medium|high"}],
  "players": [{"name": "string", "role": "string", "stance": "string", "influence_score": number}],
  "sentiment_matrix": {
    "narrative": [{"date": "ISO8601", "score": number, "label": "string"}],
    "market": [{"date": "ISO8601", "score": number, "label": "string"}]
  },
  "contrarian_views": [{"perspective": "string", "source_article_id": "string", "strength": "moderate|significant"}],
  "predictions": [{"scenario": "string", "probability": "string", "trigger": "string"}]
}`;

  const arc = await callGroq(async () => {
    const text = await groqCompletion(systemPrompt, userPrompt);
    return JSON.parse(text);
  });

  try {
    await fs.mkdir(DATA_DIR, { recursive: true });
    await fs.writeFile(cachePath, JSON.stringify(arc, null, 2));
  } catch (err) {}

  return arc;
}
