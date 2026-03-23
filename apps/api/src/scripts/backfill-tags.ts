import { articles } from "@myet/db";
import { db } from "../db";
import { tagArticle } from "../services/tagging";
import { eq } from "drizzle-orm";

async function backfillTags() {
  console.log("[Backfill] Starting...");
  const allArticles = await db.select({
    id: articles.id,
    title: articles.title,
    content: articles.content
  }).from(articles);

  console.log(`[Backfill] Found ${allArticles.length} articles.`);

  for (const article of allArticles) {
    const tag = await tagArticle({ 
      title: article.title, 
      content: article.content 
    });
    
    console.log(`[Backfill] Tagging "${article.title}" -> ${tag.topicSlugs.join(", ")}`);
    
    await db.update(articles)
      .set({ 
        topicSlugs: tag.topicSlugs,
        summary: tag.summary,
        entities: tag.entities
      })
      .where(eq(articles.id, article.id));

    // Rate limiting delay
    await new Promise(resolve => setTimeout(resolve, 1500));
  }

  console.log("[Backfill] Completed.");
  process.exit(0);
}

backfillTags();
