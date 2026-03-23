import {
  boolean,
  integer,
  jsonb,
  pgTable,
  real,
  text,
  timestamp,
  uniqueIndex,
  uuid
} from "drizzle-orm/pg-core";
import { customType } from "drizzle-orm/pg-core";

const vector = customType<{ data: number[]; driverData: string }>({
  dataType() {
    return "vector(384)";
  },
  toDriver(value) {
    return `[${value.join(",")}]`;
  },
  fromDriver(value) {
    if (typeof value !== "string") return [];
    return value
      .replace(/[\[\]]/g, "")
      .split(",")
      .map((v) => Number(v.trim()))
      .filter((v) => Number.isFinite(v));
  }
});

export const authors = pgTable("authors", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: text("name").notNull().unique(),
  handle: text("handle").notNull().unique(),
  bio: text("bio"),
  avatarUrl: text("avatar_url"),
  followersCount: integer("followers_count").notNull().default(0),
  genres: text("genres").array().notNull().default([]), // e.g. ["Business", "Tech"]
  createdAt: timestamp("created_at").notNull().defaultNow()
});

export const stories = pgTable("stories", {
  id: uuid("id").defaultRandom().primaryKey(),
  headline: text("headline").notNull(),
  articleIds: uuid("article_ids").array().notNull().default([]),
  articleCount: integer("article_count").notNull().default(0),
  topEntities: jsonb("top_entities").notNull().default([]),
  topicSlugs: text("topic_slugs").array().notNull().default([]),
  briefingCache: jsonb("briefing_cache"),
  briefingStale: boolean("briefing_stale").notNull().default(true),
  latestArticleAt: timestamp("latest_article_at"),
  createdAt: timestamp("created_at").notNull().defaultNow()
});

export const articles = pgTable(
  "articles",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    externalId: text("external_id").notNull(),
    title: text("title").notNull(),
    content: text("content").notNull(),
    summary: text("summary").notNull(),
    url: text("url").notNull(),
    source: text("source").notNull(),
    author: text("author"),
    authorId: uuid("author_id").references(() => authors.id),
    publishedAt: timestamp("published_at"),
    topicSlugs: text("topic_slugs").array().notNull().default([]),
    entities: jsonb("entities").notNull().default([]),
    storyId: uuid("story_id").references(() => stories.id),
    imageUrl: text("image_url"),
    embedding: vector("embedding"),
    articleType: text("article_type").notNull(),
    createdAt: timestamp("created_at").notNull().defaultNow()
  },
  (table) => ({
    externalIdIdx: uniqueIndex("articles_external_id_unique").on(table.externalId)
  })
);

export const users = pgTable("users", {
  id: uuid("id").defaultRandom().primaryKey(),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  embedding: vector("embedding"),
  createdAt: timestamp("created_at").notNull().defaultNow()
});

export const sessions = pgTable("sessions", {
  id: text("id").primaryKey(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull()
});

export const userTopicInterests = pgTable(
  "user_topic_interests",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id),
    topicSlug: text("topic_slug").notNull(),
    weight: real("weight").notNull().default(0),
    depthTier: text("depth_tier").notNull().default("explainer"),
    articleCount: integer("article_count").notNull().default(0),
    avgCompletion: real("avg_completion").notNull().default(0),
    lastEngagedAt: timestamp("last_engaged_at"),
    decayFactor: real("decay_factor").notNull().default(1)
  },
  (table) => ({
    uniqueUserTopic: uniqueIndex("user_topic_unique").on(
      table.userId,
      table.topicSlug
    )
  })
);

export const userEntityAffinity = pgTable(
  "user_entity_affinity",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id),
    entityName: text("entity_name").notNull(),
    entityType: text("entity_type").notNull(),
    affinityScore: real("affinity_score").notNull().default(0),
    mentionCount: integer("mention_count").notNull().default(0),
    lastSeenAt: timestamp("last_seen_at")
  },
  (table) => ({
    uniqueUserEntity: uniqueIndex("user_entity_unique").on(
      table.userId,
      table.entityName
    )
  })
);

export const articleSignals = pgTable("article_signals", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id),
  articleId: uuid("article_id")
    .notNull()
    .references(() => articles.id),
  timeSpentS: integer("time_spent_s").notNull(),
  scrollDepth: real("scroll_depth").notNull(),
  openedBriefing: boolean("opened_briefing").notNull().default(false),
  shared: boolean("shared").notNull().default(false),
  saved: boolean("saved").notNull().default(false),
  liked: boolean("liked").notNull().default(false),
  engagementScore: real("engagement_score"),
  sessionId: text("session_id").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow()
});

export const userAuthorFollows = pgTable(
  "user_author_follows",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id),
    authorId: uuid("author_id")
      .notNull()
      .references(() => authors.id),
    createdAt: timestamp("created_at").notNull().defaultNow()
  },
  (table) => ({
    uniqueUserAuthor: uniqueIndex("user_author_unique").on(
      table.userId,
      table.authorId
    )
  })
);

export const userStoryFollows = pgTable(
  "user_story_follows",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id),
    storyId: uuid("story_id")
      .notNull()
      .references(() => stories.id),
    createdAt: timestamp("created_at").notNull().defaultNow()
  },
  (table) => ({
    uniqueUserStory: uniqueIndex("user_story_unique").on(
      table.userId,
      table.storyId
    )
  })
);

export type Article = typeof articles.$inferSelect;
export type Story = typeof stories.$inferSelect;
export type User = typeof users.$inferSelect;
export type Author = typeof authors.$inferSelect;
