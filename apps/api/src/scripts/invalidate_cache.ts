import { db } from "../db";
import { stories } from "@myet/db";

async function main() {
  console.log("Invalidating all briefing caches in the database...");
  await db.update(stories).set({ briefingStale: true });
  console.log("Done! All briefings will now re-generate without citations.");
  process.exit(0);
}

main().catch(err => {
  console.error("Failed to invalidate cache:", err);
  process.exit(1);
});
