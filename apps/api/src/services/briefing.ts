import { groqCompletion } from "./anthropic";

export async function generateBriefing(params: {
  storyId: string;
  depthTier: string;
  articles: { id: string; title: string; content: string; url: string; author: string | null; publishedAt: Date | null }[];
}, onHeartbeat?: () => Promise<void>) {
  const context = params.articles
    .map(
      (article) =>
        `Article ${article.id}\nTitle: ${article.title}\nAuthor: ${article.author ?? ""}\nPublished: ${article.publishedAt ?? ""}\nContent: ${article.content}`
    )
    .join("\n\n");

  // groqCompletion already goes through the AI queue — no outer wrapper needed
  const text = await groqCompletion(
    "You are a Lead Intelligence Analyst at The Economic Times. Synthesise the provided articles into a high-stakes 'Deep Briefing'.",
    `Story context:
${context}

Instructions:
1. Synthesise ALL provided articles into a singular, cohesive intelligence report.
2. Identify core 'Themes' or 'Arguments' across the coverage.
3. If details conflict (e.g. different deficit figures), highlight the discrepancy explicitly.
4. Use a professional, insider tone (Junior Analyst -> Expert Correspondent transition based on depth_tier).
5. Return ONLY valid JSON with keys:
   - story_id: ${params.storyId}
   - headline: A sharp, analytical title.
   - executive_summary: A high-impact 'Bottom Line' paragraph (2-3 sentences).
   - sections: Array of objects { id, title, content, citations: [article_ids] }. Sections should be thematic (e.g. 'The Market Response', 'The Political Response', 'The Global Response').
   - key_entities: [{ name, type, role }]
   - suggested_questions: 3 specific, inquisitive follow-up questions to deepen the conversation.
   - source_articles: The original article metadata provided.

No preamble. No markdown wrapping.`,
    onHeartbeat
  );

  return JSON.parse(text);
}
