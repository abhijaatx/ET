import { db } from "../db";
import { users, articles } from "@myet/db";
import { updateUserEmbedding } from "../services/interest";
import { eq, isNotNull } from "drizzle-orm";

async function verify() {
  console.log("Starting Two-Tower verification...");
  
  const allUsers = await db.select().from(users).limit(1);
  const user = allUsers[0];
  if (!user) {
    console.error("No users found");
    process.exit(1);
  }
  console.log(`User: ${user.email} (ID: ${user.id})`);

  const articleResult = await db.select().from(articles).where(isNotNull(articles.embedding)).limit(1);
  const article = articleResult[0];
  if (!article || !article.embedding) {
    console.error("No articles with embeddings found");
    process.exit(1);
  }
  console.log(`Found article with embedding: ${article.title}`);

  console.log("Current user embedding first 5 values:", user.embedding?.slice(0, 5));
  
  console.log("Updating user embedding...");
  await updateUserEmbedding(user.id, article.embedding, 1.0);

  const updatedUser = await db.select().from(users).where(eq(users.id, user.id)).limit(1);
  const newEmb = updatedUser[0]?.embedding;
  
  if (newEmb) {
    console.log("New user embedding first 5 values:", newEmb.slice(0, 5));
    const isDifferent = JSON.stringify(user.embedding) !== JSON.stringify(newEmb);
    if (isDifferent || !user.embedding) {
      console.log("SUCCESS: User embedding updated correctly.");
    } else {
      console.log("FAILURE: Embedding did not change.");
    }
  } else {
    console.log("FAILURE: New embedding is null.");
  }

  process.exit(0);
}

verify().catch(err => {
  console.error(err);
  process.exit(1);
});
