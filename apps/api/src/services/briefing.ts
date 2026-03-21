import { callAnthropic, anthropic } from "./anthropic";

export async function generateBriefing(params: {
  storyId: string;
  depthTier: string;
  articles: { id: string; title: string; content: string; url: string; author: string | null; publishedAt: Date | null }[];
}) {
  const context = params.articles
    .map(
      (article) =>
        `Article ${article.id}\nTitle: ${article.title}\nAuthor: ${article.author ?? ""}\nPublished: ${article.publishedAt ?? ""}\nContent: ${article.content}`
    )
    .join("\n\n");

  return callAnthropic(async () => {
    const message = await anthropic.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 1200,
      temperature: 0.2,
      system:
        "You are an expert financial journalist. Synthesise the provided ET articles into a structured briefing. Rules:\n- Every factual claim must include [source: article_id] inline\n- Never use information not present in the provided articles\n- If articles conflict on a figure, surface the conflict explicitly\n- Return ONLY valid JSON matching the BriefingDocument schema, no preamble",
      messages: [
        {
          role: "user",
          content: `Story ID: ${params.storyId}\nUser depth tier: ${params.depthTier}\n\n${context}\n\nReturn JSON with keys: story_id, headline, generated_at, depth_tier, summary { text, citations }, sections [{ id, title, content, citations }], key_entities [{ name, type, role }], suggested_questions, source_articles [{ id, title, url, author, published_at }]. Sections must include what-happened, why-it-matters, the-numbers (only if depth_tier is informed or expert), the-other-side (only if conflicting viewpoints exist).`
        }
      ]
    });

    const text = message.content
      .map((block) => (block.type === "text" ? block.text : ""))
      .join("")
      .trim();

    return JSON.parse(text);
  });
}
