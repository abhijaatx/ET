import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema";
import "dotenv/config";
import { eq, isNull } from "drizzle-orm";

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const db = drizzle(pool, { schema });

const { articles, authors } = schema;

async function seedAuthors() {
  console.log("Backfilling authors and creating mock profiles...");

  const mockAuthors = [
    { name: "Economic Times", handle: "economictimes", bio: "The world's largest financial newspaper.", genres: ["Finance", "Business", "Markets"] },
    { name: "Abhijaat Krishna", handle: "abhijaat_k", bio: "Senior Staff Writer covering Tech and AI.", genres: ["Technology", "AI", "Development"] },
    { name: "ET Markets", handle: "etmarkets", bio: "Real-time stock market analysis and insights.", genres: ["Markets", "Stocks", "Economy"] },
  ];

  const createdAuthors: any[] = [];

  for (const mock of mockAuthors) {
    const [author] = await db.insert(authors).values({
      ...mock,
      followersCount: Math.floor(Math.random() * 50000) + 5000,
    }).onConflictDoUpdate({
      target: authors.name,
      set: { ...mock }
    }).returning();
    
    createdAuthors.push(author);
    console.log(`Created author: ${author.name} (@${author.handle})`);
  }

  // 3. Update articles to link to these authors
  const allArticles = await db.select().from(articles);
  console.log(`Linking ${allArticles.length} articles...`);

  for (let i = 0; i < allArticles.length; i++) {
    const author = createdAuthors[i % createdAuthors.length];
    await db.update(articles)
      .set({ authorId: author.id, author: author.name })
      .where(eq(articles.id, allArticles[i].id));
  }

  console.log("Backfill complete!");
  process.exit(0);
}

seedAuthors().catch(err => {
  console.error(err);
  process.exit(1);
});
