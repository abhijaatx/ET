import { Hono } from "hono";
import { db } from "../db";
import { authors, articles, userAuthorFollows } from "@myet/db";
import { eq, desc, sql, and } from "drizzle-orm";
import { authMiddleware } from "../middleware/auth";
import type { AppEnv } from "../types/app";

const routes = new Hono<AppEnv>();

// List authors (for sidebar)
routes.get("/authors", async (c) => {
  const limit = Number(c.req.query("limit") || 10);
  const results = await db.query.authors.findMany({
    orderBy: [desc(authors.followersCount)],
    limit
  });
  return c.json({ authors: results });
});

// Get author profile
routes.get("/authors/:id", async (c) => {
  const id = c.req.param("id");
  const user = c.get("user"); // Optional, from authMiddleware if present

  const author = await db.query.authors.findFirst({
    where: eq(authors.id, id)
  });

  if (!author) {
    return c.json({ error: "Author not found" }, 404);
  }

  // Also get total article count for this author
  const [countResult] = await db
    .select({ count: sql<number>`count(*)` })
    .from(articles)
    .where(eq(articles.authorId, id));

  let isFollowing = false;
  if (user && user.id) {
    const follow = await db.query.userAuthorFollows.findFirst({
      where: and(
        eq(userAuthorFollows.userId, user.id),
        eq(userAuthorFollows.authorId, id)
      )
    });
    isFollowing = !!follow;
  }

  return c.json({
    ...author,
    articleCount: Number(countResult?.count || 0),
    isFollowing
  });
});

// ... (Get author articles feed stays same)

// Real follow (record relation and increment counter)
routes.post("/authors/:id/follow", authMiddleware, async (c) => {
  const authorId = c.req.param("id");
  const user = c.get("user");
  
  if (!user || !user.id) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  try {
    await db
      .insert(userAuthorFollows)
      .values({
        userId: user.id as string,
        authorId: authorId as string
      })
      .onConflictDoNothing();

    const result = await db
      .update(authors)
      .set({
        followersCount: sql`${authors.followersCount} + 1`
      })
      .where(eq(authors.id, authorId as string))
      .returning();

    return c.json({ success: true, isFollowing: true });
  } catch (err) {
    console.error("Follow error:", err);
    return c.json({ error: "Failed to follow author" }, 500);
  }
});

// Unfollow
routes.post("/authors/:id/unfollow", authMiddleware, async (c) => {
  const authorId = c.req.param("id");
  const user = c.get("user");
  
  if (!user || !user.id) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  try {
    const deleted = await db
      .delete(userAuthorFollows)
      .where(
        and(
          eq(userAuthorFollows.userId, user.id as string),
          eq(userAuthorFollows.authorId, authorId as string)
        )
      )
      .returning();

    if (deleted.length > 0) {
      await db
        .update(authors)
        .set({
          followersCount: sql`GREATEST(${authors.followersCount} - 1, 0)`
        })
        .where(eq(authors.id, authorId));
    }

    return c.json({ success: true, isFollowing: false });
  } catch (err) {
    console.error("Unfollow error:", err);
    return c.json({ error: "Failed to unfollow author" }, 500);
  }
});

export default routes;
