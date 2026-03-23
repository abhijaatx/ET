import { eq } from "drizzle-orm";
import { articles } from "@myet/db";
import { db } from "../db";
import { generateStoryArc } from "../services/story_arc";

async function testArc(storyId: string) {
  console.log(`[Test] Generating Story Arc for: ${storyId}`);
  
  const storyArticles = await db
    .select()
    .from(articles)
    .where(eq(articles.storyId, storyId));

  if (storyArticles.length === 0) {
    console.error("No articles found");
    process.exit(1);
  }

  const arc = await generateStoryArc({
    storyId,
    articles: storyArticles.map(a => ({
      id: a.id,
      title: a.title,
      summary: (a.content ?? "").slice(0, 1000),
      publishedAt: a.publishedAt,
    }))
  });

  console.log(JSON.stringify(arc, null, 2));
  process.exit(0);
}

testArc(process.argv[2] || "cbac3e6d-43bc-4deb-95c0-8a2f0c903879");
