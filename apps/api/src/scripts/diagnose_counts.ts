import { db } from "../db";
import { articles, stories } from "@myet/db";
import { count, isNotNull, sql } from "drizzle-orm";

async function diagnoseCounts() {
  const [totalArticles] = await db.select({ value: count() }).from(articles);
  const [totalStories] = await db.select({ value: count() }).from(stories);
  
  const todayMidnight = new Date();
  todayMidnight.setHours(0,0,0,0);
  
  const [storiesToday] = await db.select({ value: count() }).from(stories)
    .where(sql`${stories.latestArticleAt} >= ${todayMidnight}`);
    
  const [storiesWithBriefingToday] = await db.select({ value: count() }).from(stories)
    .where(sql`${stories.latestArticleAt} >= ${todayMidnight} AND briefing_cache IS NOT NULL`);

  console.log(`\n--- DATABASE DIAGNOSTICS ---`);
  console.log(`Total Articles: ${totalArticles.value}`);
  console.log(`Total Stories: ${totalStories.value}`);
  console.log(`Stories from Today: ${storiesToday.value}`);
  console.log(`Stories with Briefings Today: ${storiesWithBriefingToday.value}`);
}

diagnoseCounts().then(() => process.exit(0)).catch(console.error);
