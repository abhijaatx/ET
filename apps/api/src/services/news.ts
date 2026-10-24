import Parser from "rss-parser";
import { env } from "../env";
import { scrapeTechCrunch, scrapeETTech } from "./scraper";

export type RawArticle = {
  externalId: string;
  title: string;
  content: string;
  url: string;
  imageUrl?: string | null;
  source: string;
  author: string | null;
  publishedAt: Date | null;
  category?: string;
};

type RssItemFields = { source?: string };

const rssFeeds: { url: string; category: string; source: string }[] = [
  // ── The Economic Times ──────────────────────────────────────────────
  { url: "https://economictimes.indiatimes.com/rssfeedstopstories.cms", category: "top-news", source: "Economic Times" },
  { url: "https://economictimes.indiatimes.com/markets/rssfeeds/1977021501.cms", category: "markets", source: "Economic Times" },
  { url: "https://economictimes.indiatimes.com/industry/rssfeeds/13352306.cms", category: "business", source: "Economic Times" },
  { url: "https://economictimes.indiatimes.com/tech/rssfeeds/13358319.cms", category: "technology", source: "Economic Times" },

  // ── Google News (India-focused) ─────────────────────────────────────
  { url: "https://news.google.com/rss/headlines/section/topic/WORLD?hl=en-IN&gl=IN&ceid=IN:en", category: "world", source: "Google News" },
  { url: "https://news.google.com/rss/headlines/section/topic/NATION?hl=en-IN&gl=IN&ceid=IN:en", category: "policy", source: "Google News" },
  { url: "https://news.google.com/rss/headlines/section/topic/BUSINESS?hl=en-IN&gl=IN&ceid=IN:en", category: "business", source: "Google News" },
  { url: "https://news.google.com/rss/headlines/section/topic/TECHNOLOGY?hl=en-IN&gl=IN&ceid=IN:en", category: "technology", source: "Google News" },
  { url: "https://news.google.com/rss/headlines/section/topic/SCIENCE?hl=en-IN&gl=IN&ceid=IN:en", category: "science", source: "Google News" },
  { url: "https://news.google.com/rss/search?q=finance+stock+market&hl=en-IN&gl=IN&ceid=IN:en", category: "markets", source: "Google News" },

  // ── BBC (World & Tech) ──────────────────────────────────────────────
  { url: "https://feeds.bbci.co.uk/news/world/rss.xml", category: "world", source: "BBC News" },
  { url: "https://feeds.bbci.co.uk/news/business/rss.xml", category: "business", source: "BBC News" },
  { url: "https://feeds.bbci.co.uk/news/technology/rss.xml", category: "technology", source: "BBC News" },
  { url: "https://feeds.bbci.co.uk/news/science_and_environment/rss.xml", category: "science", source: "BBC News" },
  { url: "https://feeds.bbci.co.uk/news/health/rss.xml", category: "health", source: "BBC News" },
  { url: "https://feeds.bbci.co.uk/news/politics/rss.xml", category: "policy", source: "BBC News" },

  // ── Tech News ───────────────────────────────────────────────────────
  { url: "https://techcrunch.com/feed/", category: "technology", source: "TechCrunch" },
  { url: "https://www.theverge.com/rss/index.xml", category: "technology", source: "The Verge" },
  { url: "https://feeds.arstechnica.com/arstechnica/index", category: "technology", source: "Ars Technica" },
  { url: "https://www.wired.com/feed/rss", category: "technology", source: "WIRED" },
  { url: "https://feeds.feedburner.com/venturebeat/SZYF", category: "technology", source: "VentureBeat" },
  { url: "https://hnrss.org/frontpage", category: "technology", source: "Hacker News" },
];

const parser = new Parser<Record<string, never>, RssItemFields>({
  customFields: { item: ["source"] }
});

async function fetchNewsApi(category: string, country: string = "us"): Promise<RawArticle[]> {
  if (!env.NEWSAPI_KEY) return [];
  const url = new URL("https://newsapi.org/v2/top-headlines");
  url.searchParams.set("country", country);
  url.searchParams.set("category", category);
  url.searchParams.set("pageSize", "100");
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
      urlToImage: string | null;
      source: { id: string | null; name: string };
    }[];
  };

  return data.articles.map((article) => ({
    externalId: article.url,
    title: article.title,
    content: article.content ?? article.description ?? "",
    url: article.url,
    imageUrl: article.urlToImage,
    source: article.source.name || "News",
    author: article.author,
    publishedAt: article.publishedAt ? new Date(article.publishedAt) : null,
    category: category
  }));
}

async function fetchGNews(topic: string = "business", country: string = "in"): Promise<RawArticle[]> {
  if (!env.GNEWS_KEY) return [];
  const url = new URL("https://gnews.io/api/v4/top-headlines");
  url.searchParams.set("country", country);
  url.searchParams.set("topic", topic);
  url.searchParams.set("max", "100");
  url.searchParams.set("token", env.GNEWS_KEY);

  const res = await fetch(url.toString());
  if (!res.ok) return [];
  const data = (await res.json()) as {
    articles: {
      title: string;
      description: string | null;
      content: string | null;
      url: string;
      image: string | null;
      publishedAt: string;
      source: { name: string };
    }[];
  };

  return data.articles.map((article) => ({
    externalId: article.url,
    title: article.title,
    content: article.content ?? article.description ?? "",
    url: article.url,
    imageUrl: article.image,
    source: article.source.name || "News",
    author: null,
    publishedAt: article.publishedAt ? new Date(article.publishedAt) : null
  }));
}

async function fetchRss(): Promise<RawArticle[]> {
  const results: RawArticle[] = [];
  for (const feed of rssFeeds) {
    try {
      const parsed = await parser.parseURL(feed.url);
      parsed.items.forEach((item) => {
        if (!item.link || !item.title) return;
        const imageUrl = item.enclosure?.url ||
          (item.content?.match(/src="([^"]+)"/) || [])[1] ||
          null;
        results.push({
          externalId: item.guid ?? item.link,
          title: item.title,
          content: item.contentSnippet ?? item.content ?? "",
          url: item.link,
          imageUrl,
          source: item.source?.trim() || feed.source,
          author: item.creator ?? null,
          publishedAt: item.isoDate ? new Date(item.isoDate) : null,
          category: feed.category
        });
      });
    } catch (e) {
      console.error(`Failed to fetch RSS from ${feed.url}:`, e);
    }
  }
  return results;
}

export async function fetchAllArticles(): Promise<RawArticle[]> {
  const categories = ["technology", "business", "science", "general", "health", "sports", "entertainment"];
  const countries = ["us", "in", "gb", "ca", "au"];

  const newsapiResults: RawArticle[][] = [];
  for (const country of countries) {
    for (const cat of categories) {
      const res = await fetchNewsApi(cat, country).catch(() => []);
      newsapiResults.push(res);
      await new Promise(resolve => setTimeout(resolve, 300));
    }
  }

  const gnewsResults: RawArticle[][] = [];
  for (const topic of ["business", "technology", "world", "science"]) {
    const res = await fetchGNews(topic, "in").catch(() => []);
    gnewsResults.push(res);
    await new Promise(resolve => setTimeout(resolve, 300));
  }

  const [rss, scrapedTC, scrapedET] = await Promise.all([
    fetchRss().catch(() => []),
    scrapeTechCrunch().catch(() => []),
    scrapeETTech().catch(() => [])
  ]);

  return [
    ...scrapedTC,
    ...scrapedET,
    ...rss,
    ...newsapiResults.flat(),
    ...gnewsResults.flat()
  ];
}
