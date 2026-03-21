import Parser from "rss-parser";
import { env } from "../env";

export type RawArticle = {
  externalId: string;
  title: string;
  content: string;
  url: string;
  source: "economictimes" | "newsapi" | "gnews";
  author: string | null;
  publishedAt: Date | null;
};

const rssFeeds = [
  "https://economictimes.indiatimes.com/rssfeedstopstories.cms",
  "https://economictimes.indiatimes.com/markets/rssfeeds/1977021501.cms",
  "https://economictimes.indiatimes.com/industry/rssfeeds/13352306.cms"
];

const parser = new Parser();

async function fetchNewsApi(): Promise<RawArticle[]> {
  if (!env.NEWSAPI_KEY) return [];
  const url = new URL("https://newsapi.org/v2/top-headlines");
  url.searchParams.set("country", "in");
  url.searchParams.set("category", "business");
  url.searchParams.set("pageSize", "50");
  url.searchParams.set("apiKey", env.NEWSAPI_KEY);

  const res = await fetch(url.toString());
  if (!res.ok) return [];
  const data = (await res.json()) as {
    articles: {
      title: string;
      description: string | null;
      content: string | null;
      url: string;
      author: string | null;
      publishedAt: string;
      source: { id: string | null; name: string };
    }[];
  };

  return data.articles.map((article) => ({
    externalId: article.url,
    title: article.title,
    content: article.content ?? article.description ?? "",
    url: article.url,
    source: "newsapi",
    author: article.author,
    publishedAt: article.publishedAt ? new Date(article.publishedAt) : null
  }));
}

async function fetchGNews(): Promise<RawArticle[]> {
  if (!env.GNEWS_KEY) return [];
  const url = new URL("https://gnews.io/api/v4/top-headlines");
  url.searchParams.set("country", "in");
  url.searchParams.set("topic", "business");
  url.searchParams.set("max", "50");
  url.searchParams.set("token", env.GNEWS_KEY);

  const res = await fetch(url.toString());
  if (!res.ok) return [];
  const data = (await res.json()) as {
    articles: {
      title: string;
      description: string | null;
      content: string | null;
      url: string;
      publishedAt: string;
      source: { name: string };
    }[];
  };

  return data.articles.map((article) => ({
    externalId: article.url,
    title: article.title,
    content: article.content ?? article.description ?? "",
    url: article.url,
    source: "gnews",
    author: null,
    publishedAt: article.publishedAt ? new Date(article.publishedAt) : null
  }));
}

async function fetchRss(): Promise<RawArticle[]> {
  const results: RawArticle[] = [];
  for (const feed of rssFeeds) {
    const parsed = await parser.parseURL(feed);
    parsed.items.forEach((item) => {
      if (!item.link || !item.title) return;
      results.push({
        externalId: item.guid ?? item.link,
        title: item.title,
        content: item.contentSnippet ?? item.content ?? "",
        url: item.link,
        source: "economictimes",
        author: item.creator ?? null,
        publishedAt: item.isoDate ? new Date(item.isoDate) : null
      });
    });
  }
  return results;
}

export async function fetchAllArticles(): Promise<RawArticle[]> {
  const [newsapi, gnews, rss] = await Promise.all([
    fetchNewsApi(),
    fetchGNews(),
    fetchRss()
  ]);

  return [...rss, ...newsapi, ...gnews];
}
