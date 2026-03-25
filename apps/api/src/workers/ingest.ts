import { Worker } from "bullmq";
import { eq } from "drizzle-orm";
import { sql } from "drizzle-orm";
import { articles, stories } from "@myet/db";
import { db } from "../db";
import { redis } from "../redis";
import { embedText } from "../services/embeddings";
import { fetchAllArticles } from "../services/news";
import { tagArticle } from "../services/tagging";
import { callGroq, groqCompletion } from "../services/anthropic";
import { enqueueStoryAI } from "../queues/story-ai";
import { deepScrapeArticle } from "../services/scraper";

async function generateHeadline(title: string, summary: string) {
  try {
    return await callGroq(async () => {
      return await groqCompletion(
        "Generate a canonical headline for this story.",
        `Title: ${title}\nSummary: ${summary}\nReturn ONLY a concise canonical headline, with no extra text or quotation marks.`
      );
    });
  } catch (e) {
    return title;
  }
}

export const ingestWorker = new Worker(
  "ingest",
  async (job) => {
    const rawArticles = (await fetchAllArticles()).filter(a => a.imageUrl && a.imageUrl.startsWith("http"));
    console.log(`[ingest] Fetched ${rawArticles.length} articles with images`);

    for (const raw of rawArticles) {
      const embedding = await embedText(`${raw.title}\n${raw.content}`);
      const embeddingVector = sql`${`[${embedding.join(",")}]`}::vector`;

      const nearest = (await db.execute(
        sql`SELECT story_id FROM articles WHERE embedding <=> ${embeddingVector} < 0.18 ORDER BY embedding <=> ${embeddingVector} LIMIT 1`
      )) as { rows: { story_id: string | null }[] };

      let storyId: string | null = null;
      const nearestRow = nearest.rows[0];
      if (nearestRow?.story_id) {
        storyId = String(nearestRow.story_id);
      }

      const tag = await tagArticle({ title: raw.title, content: raw.content });
      const headline = storyId
        ? null
        : await generateHeadline(raw.title, tag.summary);

      // Deep scrape for full content if the initial snippet is too short
      let fullContent = raw.content;
      if (!fullContent || fullContent.length < 300) {
        console.log(`[ingest] Deep scraping for: ${raw.title}`);
        const scraped = await deepScrapeArticle(raw.url, raw.source);
        if (scraped && scraped.length > fullContent.length) {
          fullContent = scraped;
        }
      }

      // Add a small delay to avoid hitting Groq's rate limit during batch processing
      await new Promise((resolve) => setTimeout(resolve, 3000));

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
              latestArticleAt: new Date(),
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
            content: fullContent,
            summary: tag.summary,
            url: raw.url,
            imageUrl: raw.imageUrl,
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
              latestArticleAt: new Date(),
              briefingStale: true
            })
            .where(eq(stories.id, finalStoryId));

          // Enqueue background AI processing for the story
          await enqueueStoryAI(finalStoryId);
        }
      });
    }
  },
  {
    connection: redis as any
  }
);

ingestWorker.on("failed", (job, err) => {
  console.error("Ingest job failed", job?.id, err);
});
