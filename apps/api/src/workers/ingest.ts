import { Worker } from "bullmq";
import { eq } from "drizzle-orm";
import { sql } from "drizzle-orm";
import { articles, stories } from "@myet/db";
import { db } from "../db";
import { redis } from "../redis";
import { embedText } from "../services/embeddings";
import { fetchAllArticles } from "../services/news";
import { tagArticle } from "../services/tagging";
import { callAnthropic, anthropic } from "../services/anthropic";

async function generateHeadline(title: string, summary: string) {
  return callAnthropic(async () => {
    const message = await anthropic.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 40,
      temperature: 0.3,
      system: "Generate a canonical headline for this story.",
      messages: [
        {
          role: "user",
          content: `Title: ${title}\nSummary: ${summary}\nReturn a concise canonical headline.`
        }
      ]
    });

    return message.content
      .map((block) => (block.type === "text" ? block.text : ""))
      .join("")
      .trim();
  });
}

export const ingestWorker = new Worker(
  "ingest",
  async () => {
    const rawArticles = await fetchAllArticles();

    for (const raw of rawArticles) {
      const embedding = await embedText(`${raw.title}\n${raw.content}`);
      const embeddingVector = sql`${`[${embedding.join(",")}]`}::vector`;

      const nearest = await db.execute(
        sql`SELECT story_id FROM articles WHERE embedding <=> ${embeddingVector} < 0.18 ORDER BY embedding <=> ${embeddingVector} LIMIT 1`
      );

      let storyId: string | null = null;
      if (nearest.rows.length > 0 && nearest.rows[0]?.story_id) {
        storyId = String(nearest.rows[0].story_id);
      }

      const tag = await tagArticle({ title: raw.title, content: raw.content });
      const headline = storyId
        ? null
        : await generateHeadline(raw.title, tag.summary);

      await db.transaction(async (tx) => {
        const existing = await tx
          .select({ id: articles.id })
          .from(articles)
          .where(eq(articles.externalId, raw.externalId))
          .limit(1);

        if (existing.length > 0) return;

        let finalStoryId = storyId;
        if (!finalStoryId) {
          const insertedStory = await tx
            .insert(stories)
            .values({
              headline: headline ?? raw.title,
              articleIds: [],
              articleCount: 0,
              topEntities: tag.entities,
              topicSlugs: tag.topicSlugs,
              latestArticleAt: raw.publishedAt,
              briefingStale: true
            })
            .returning({ id: stories.id });

          finalStoryId = insertedStory[0]?.id ?? null;
        }

        const insertedArticle = await tx
          .insert(articles)
          .values({
            externalId: raw.externalId,
            title: raw.title,
            content: raw.content,
            summary: tag.summary,
            url: raw.url,
            source: raw.source,
            author: raw.author,
            publishedAt: raw.publishedAt,
            topicSlugs: tag.topicSlugs,
            entities: tag.entities,
            storyId: finalStoryId,
            embedding,
            articleType: tag.articleType
          })
          .returning({ id: articles.id });

        const articleId = insertedArticle[0]?.id ?? null;
        console.log(`[ingest] ${raw.title}`);

        if (finalStoryId && articleId) {
          const story = await tx
            .select({
              articleIds: stories.articleIds,
              articleCount: stories.articleCount
            })
            .from(stories)
            .where(eq(stories.id, finalStoryId))
            .limit(1);

          const existingStory = story[0];
          const updatedIds = existingStory?.articleIds
            ? [...existingStory.articleIds, articleId]
            : [articleId];
          const updatedCount = (existingStory?.articleCount ?? 0) + 1;

          await tx
            .update(stories)
            .set({
              articleIds: updatedIds,
              articleCount: updatedCount,
              latestArticleAt: raw.publishedAt,
              briefingStale: true
            })
            .where(eq(stories.id, finalStoryId));
        }
      });
    }
  },
  {
    connection: redis
  }
);

ingestWorker.on("failed", (job, err) => {
  console.error("Ingest job failed", job?.id, err);
});
