import { and, eq, inArray } from "drizzle-orm";
import {
  articleSignals,
  articles,
  userEntityAffinity,
  userTopicInterests,
  users
} from "@myet/db";
import { db } from "../db";
import { clamp } from "../utils/engagement";

function daysBetween(a: Date, b: Date) {
  const diff = Math.abs(a.getTime() - b.getTime());
  return diff / (1000 * 60 * 60 * 24);
}

export async function updateInterestGraphForSession(
  userId: string,
  sessionId: string
) {
  const signals = await db
    .select({
      engagementScore: articleSignals.engagementScore,
      articleId: articleSignals.articleId,
      topicSlugs: articles.topicSlugs,
      entities: articles.entities
    })
    .from(articleSignals)
    .innerJoin(articles, eq(articleSignals.articleId, articles.id))
    .where(
      and(eq(articleSignals.userId, userId), eq(articleSignals.sessionId, sessionId))
    );

  if (signals.length === 0) return;

  const topicSet = new Set<string>();
  const entitySet = new Set<string>();

  signals.forEach((signal) => {
    signal.topicSlugs.forEach((slug) => topicSet.add(slug));
    const entities = (signal.entities ?? []) as { name: string; type: string }[];
    entities.forEach((entity) => entitySet.add(entity.name));
  });

  const topics = Array.from(topicSet);
  const entities = Array.from(entitySet);

  const existingTopics = topics.length
    ? await db
        .select()
        .from(userTopicInterests)
        .where(
          and(
            eq(userTopicInterests.userId, userId),
            inArray(userTopicInterests.topicSlug, topics)
          )
        )
    : [];

  const existingEntities = entities.length
    ? await db
        .select()
        .from(userEntityAffinity)
        .where(
          and(
            eq(userEntityAffinity.userId, userId),
            inArray(userEntityAffinity.entityName, entities)
          )
        )
    : [];

  const topicMap = new Map(existingTopics.map((topic) => [topic.topicSlug, topic]));
  const entityMap = new Map(existingEntities.map((entity) => [entity.entityName, entity]));

  const now = new Date();

  for (const signal of signals) {
    const engagement = signal.engagementScore ?? 0;
    const completion = clamp(engagement, 0, 1);

    for (const topicSlug of signal.topicSlugs) {
      const existing = topicMap.get(topicSlug);
      const oldWeight = existing?.weight ?? 0;
      const updatedWeight =
        engagement < 0.1 ? oldWeight * 0.8 : oldWeight * 0.7 + engagement * 0.3;
      const lastEngaged = existing?.lastEngagedAt ?? now;
      const daysInactive = daysBetween(now, lastEngaged);
      const decayFactor = Math.pow(0.5, daysInactive / 14);
      const finalWeight = updatedWeight * decayFactor;
      const articleCount = (existing?.articleCount ?? 0) + 1;
      const avgCompletion =
        ((existing?.avgCompletion ?? 0) * (articleCount - 1) + completion) /
        articleCount;

      let depthTier = existing?.depthTier ?? "explainer";
      if (articleCount % 5 === 0) {
        if (avgCompletion < 0.5) depthTier = "explainer";
        else if (avgCompletion <= 0.8) depthTier = "informed";
        else depthTier = "expert";
      }

      await db
        .insert(userTopicInterests)
        .values({
          userId,
          topicSlug,
          weight: finalWeight,
          articleCount,
          avgCompletion,
          lastEngagedAt: now,
          decayFactor,
          depthTier
        })
        .onConflictDoUpdate({
          target: [userTopicInterests.userId, userTopicInterests.topicSlug],
          set: {
            weight: finalWeight,
            articleCount,
            avgCompletion,
            lastEngagedAt: now,
            decayFactor,
            depthTier
          }
        });

      topicMap.set(topicSlug, {
        id: existing?.id ?? "",
        userId,
        topicSlug,
        weight: finalWeight,
        depthTier,
        articleCount,
        avgCompletion,
        lastEngagedAt: now,
        decayFactor
      });
    }

    const entities = (signal.entities ?? []) as { name: string; type: string }[];
    for (const entity of entities) {
      const existing = entityMap.get(entity.name);
      const oldScore = existing?.affinityScore ?? 0;
      const updatedScore =
        engagement < 0.1 ? oldScore * 0.8 : oldScore * 0.85 + engagement * 0.15;
      const lastSeen = existing?.lastSeenAt ?? now;
      const daysInactive = daysBetween(now, lastSeen);
      const decayFactor = Math.pow(0.5, daysInactive / 14);
      const finalScore = updatedScore * decayFactor;
      const mentionCount = (existing?.mentionCount ?? 0) + 1;

      await db
        .insert(userEntityAffinity)
        .values({
          userId,
          entityName: entity.name,
          entityType: entity.type,
          affinityScore: finalScore,
          mentionCount,
          lastSeenAt: now
        })
        .onConflictDoUpdate({
          target: [userEntityAffinity.userId, userEntityAffinity.entityName],
          set: {
            affinityScore: finalScore,
            mentionCount,
            lastSeenAt: now
          }
        });

      entityMap.set(entity.name, {
        id: existing?.id ?? "",
        userId,
        entityName: entity.name,
        entityType: entity.type,
        affinityScore: finalScore,
        mentionCount,
        lastSeenAt: now
      });
    }

    // Two-Tower Model: Update User Embedding Vector
    if (signal.engagementScore && signal.engagementScore > 0.1) {
      const article = await db.select({ embedding: articles.embedding }).from(articles).where(eq(articles.id, signal.articleId)).limit(1);
      if (article[0]?.embedding) {
        await updateUserEmbedding(userId, article[0].embedding, signal.engagementScore);
      }
    }
  }
}

export async function updateUserEmbedding(userId: string, articleEmbedding: number[], engagementScore: number) {
  const user = await db.select({ embedding: users.embedding }).from(users).where(eq(users.id, userId)).limit(1);
  const foundUser = user[0];
  if (!foundUser) return;

  const alpha = 0.1 * clamp(engagementScore, 0, 1); // Learning rate
  let newEmbedding: number[];

  if (!foundUser.embedding || foundUser.embedding.every(v => v === 0)) {
    newEmbedding = articleEmbedding;
  } else {
    const currentEmb = foundUser.embedding;
    newEmbedding = currentEmb.map((val, i) => val * (1 - alpha) + (articleEmbedding[i] ?? 0) * alpha);
  }

  await db.update(users).set({ embedding: newEmbedding }).where(eq(users.id, userId));
}

export async function updateInterestGraphForSignal(params: {
  userId: string;
  articleId: string;
  engagementScore: number;
}) {
  const article = await db
    .select({ topicSlugs: articles.topicSlugs, entities: articles.entities, embedding: articles.embedding })
    .from(articles)
    .where(eq(articles.id, params.articleId))
    .limit(1);

  const found = article[0];
  if (!found) return;

  const now = new Date();
  const completion = clamp(params.engagementScore, 0, 1);

  for (const topicSlug of found.topicSlugs) {
    const existing = await db
      .select()
      .from(userTopicInterests)
      .where(
        and(
          eq(userTopicInterests.userId, params.userId),
          eq(userTopicInterests.topicSlug, topicSlug)
        )
      )
      .limit(1);

    const current = existing[0];
    const oldWeight = current?.weight ?? 0;
    const updatedWeight =
      params.engagementScore < 0.1
        ? oldWeight * 0.8
        : oldWeight * 0.7 + params.engagementScore * 0.3;
    const lastEngaged = current?.lastEngagedAt ?? now;
    const daysInactive = daysBetween(now, lastEngaged);
    const decayFactor = Math.pow(0.5, daysInactive / 14);
    const finalWeight = updatedWeight * decayFactor;
    const articleCount = (current?.articleCount ?? 0) + 1;
    const avgCompletion =
      ((current?.avgCompletion ?? 0) * (articleCount - 1) + completion) /
      articleCount;

    let depthTier = current?.depthTier ?? "explainer";
    if (articleCount % 5 === 0) {
      if (avgCompletion < 0.5) depthTier = "explainer";
      else if (avgCompletion <= 0.8) depthTier = "informed";
      else depthTier = "expert";
    }

    await db
      .insert(userTopicInterests)
      .values({
        userId: params.userId,
        topicSlug,
        weight: finalWeight,
        articleCount,
        avgCompletion,
        lastEngagedAt: now,
        decayFactor,
        depthTier
      })
      .onConflictDoUpdate({
        target: [userTopicInterests.userId, userTopicInterests.topicSlug],
        set: {
          weight: finalWeight,
          articleCount,
          avgCompletion,
          lastEngagedAt: now,
          decayFactor,
          depthTier
        }
      });
  }

  const entities = (found.entities ?? []) as { name: string; type: string }[];
  for (const entity of entities) {
    const existing = await db
      .select()
      .from(userEntityAffinity)
      .where(
        and(
          eq(userEntityAffinity.userId, params.userId),
          eq(userEntityAffinity.entityName, entity.name)
        )
      )
      .limit(1);

    const current = existing[0];
    const oldScore = current?.affinityScore ?? 0;
    const updatedScore =
      params.engagementScore < 0.1
        ? oldScore * 0.8
        : oldScore * 0.85 + params.engagementScore * 0.15;
    const lastSeen = current?.lastSeenAt ?? now;
    const daysInactive = daysBetween(now, lastSeen);
    const decayFactor = Math.pow(0.5, daysInactive / 14);
    const finalScore = updatedScore * decayFactor;
    const mentionCount = (current?.mentionCount ?? 0) + 1;

    await db
      .insert(userEntityAffinity)
      .values({
        userId: params.userId,
        entityName: entity.name,
        entityType: entity.type,
        affinityScore: finalScore,
        mentionCount,
        lastSeenAt: now
      })
      .onConflictDoUpdate({
        target: [userEntityAffinity.userId, userEntityAffinity.entityName],
        set: {
          affinityScore: finalScore,
          mentionCount,
          lastSeenAt: now
        }
      });
  }

  // Two-Tower Model: Update User Embedding Vector
  if (params.engagementScore > 0.1 && found.embedding) {
    await updateUserEmbedding(params.userId, found.embedding, params.engagementScore);
  }
}
