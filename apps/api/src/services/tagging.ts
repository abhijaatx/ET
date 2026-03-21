import { callAnthropic, anthropic } from "./anthropic";
import { TOPIC_TAXONOMY } from "./taxonomy";

export type TaggedArticle = {
  topicSlugs: string[];
  entities: { id?: string; name: string; type: string; mentions?: number }[];
  articleType: "news" | "analysis" | "opinion" | "data";
  summary: string;
};

const taxonomyList = TOPIC_TAXONOMY.join(", ");

export async function tagArticle(params: {
  title: string;
  content: string;
}) {
  return callAnthropic(async () => {
    const message = await anthropic.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 400,
      temperature: 0.2,
      system:
        "You are a financial news tagger. Return only valid JSON with keys: topic_slugs (max 4, from the provided taxonomy), entities (array of {name, type}), article_type, summary (2 sentences).",
      messages: [
        {
          role: "user",
          content: `Taxonomy: ${taxonomyList}\n\nTitle: ${params.title}\nContent: ${params.content}`
        }
      ]
    });

    const text = message.content
      .map((block) => (block.type === "text" ? block.text : ""))
      .join("")
      .trim();

    const parsed = JSON.parse(text) as {
      topic_slugs: string[];
      entities: { name: string; type: string }[];
      article_type: TaggedArticle["articleType"];
      summary: string;
    };

    const filteredTopics = parsed.topic_slugs.filter((slug) =>
      TOPIC_TAXONOMY.includes(slug as (typeof TOPIC_TAXONOMY)[number])
    );

    return {
      topicSlugs: filteredTopics.slice(0, 4),
      entities: parsed.entities,
      articleType: parsed.article_type,
      summary: parsed.summary
    } satisfies TaggedArticle;
  });
}
