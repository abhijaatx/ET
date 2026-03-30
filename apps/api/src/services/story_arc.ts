import { groqCompletion } from "./anthropic";

export type StoryArc = {
  story_id: string;
  timeline: { date: string; event: string; article_id: string; impact_level: "low" | "medium" | "high" }[];
  players: { name: string; role: string; stance: string; influence_score: number }[];
  contrarian_views: { perspective: string; source_article_id: string; strength: "moderate" | "significant" }[];
  predictions: { scenario: string; probability: string; trigger: string }[];
};

export async function generateStoryArc(params: {
  storyId: string;
  articles: { id: string; title: string; summary: string; publishedAt: Date | null }[];
}, onHeartbeat?: () => Promise<void>) {
  const context = params.articles
    .map(a => `[Article: ${a.id}, Date: ${a.publishedAt?.toISOString() ?? "N/A"}]\nTitle: ${a.title}\nSummary: ${a.summary}`)
    .join("\n\n---\n\n");

  const systemPrompt = `You are a Senior Strategic Financial Analyst. Build a "Story Arc" narrative.
Analyze the provided articles to extract:
1. A chronological timeline of high-impact events.
2. Key players and their evolving power dynamics.
3. Contrarian perspectives that challenge the consensus.
4. High-probability future scenarios with specific triggers.

Return ONLY valid JSON.`;

  const userPrompt = `Articles:
${context}

Return JSON with schema:
{
  "story_id": "${params.storyId}",
  "timeline": [{"date": "ISO8601", "event": "string", "article_id": "string", "impact_level": "low|medium|high"}],
  "players": [{"name": "string", "role": "string", "stance": "string", "influence_score": number}],
  "contrarian_views": [{"perspective": "string", "source_article_id": "string", "strength": "moderate|significant"}],
  "predictions": [{"scenario": "string", "probability": "string", "trigger": "string"}]
}`;

  // groqCompletion already goes through the AI queue — no outer wrapper needed
  const text = await groqCompletion(systemPrompt, userPrompt, onHeartbeat);
  return JSON.parse(text);
}
