import { articles, stories, articleSignals, userTopicInterests, userEntityAffinity } from "@myet/db";
import { db } from "../db";
import { sql } from "drizzle-orm";

async function wipeDatabase() {
  console.log("[Wipe] Starting database fresh start...");
  
  try {
    // Delete in order of dependencies
    await db.delete(articleSignals);
    console.log("[Wipe] Cleared article signals.");
    
    await db.delete(articles);
    console.log("[Wipe] Cleared articles.");
    
    await db.delete(stories);
    console.log("[Wipe] Cleared stories.");

    await db.delete(userTopicInterests);
    await db.delete(userEntityAffinity);
    console.log("[Wipe] Cleared user interests and affinities.");

    // Optional: Reset sequences if using serial IDs (we use UUIDs, so skip)
    
    console.log("[Wipe] Database is now clean.");
  } catch (err) {
    console.error("[Wipe] Error during database wipe:", err);
  } finally {
    process.exit(0);
  }
}

wipeDatabase();
