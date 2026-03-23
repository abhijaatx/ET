import Parser from "rss-parser";
import { env } from "../env";
import { scrapeTechCrunch, scrapeETTech } from "./scraper";

export type RawArticle = {
  externalId: string;
  title: string;
  content: string;
  url: string;
  imageUrl?: string | null;
  source: "economictimes" | "newsapi" | "gnews" | "techcrunch";
  author: string | null;
  publishedAt: Date | null;
  category?: string;
};

const rssFeeds = [
  { url: "https://economictimes.indiatimes.com/rssfeedstopstories.cms", category: "top-news" },
  { url: "https://economictimes.indiatimes.com/markets/rssfeeds/1977021501.cms", category: "markets" },
  { url: "https://economictimes.indiatimes.com/industry/rssfeeds/13352306.cms", category: "business" },
  { url: "https://economictimes.indiatimes.com/wealth/rssfeeds/13354030.cms", category: "wealth" },
  { url: "https://economictimes.indiatimes.com/news/politics/and-nation/rssfeeds/10527306.cms", category: "policy" },
  { url: "https://economictimes.indiatimes.com/news/science/rssfeeds/3911647.cms", category: "science" },
  { url: "https://economictimes.indiatimes.com/tech/rssfeeds/13358319.cms", category: "technology" },
  { url: "https://economictimes.indiatimes.com/news/international/world/rssfeeds/2146843.cms", category: "world" },
  { url: "https://www.reutersagency.com/feed/?best-topics=tech", category: "technology" },
  { url: "https://www.reutersagency.com/feed/?best-topics=business", category: "business" },
  { url: "http://feeds.bbci.co.uk/news/technology/rss.xml", category: "technology" },
  { url: "http://feeds.bbci.co.uk/news/world/rss.xml", category: "world" },
  { url: "http://feeds.bbci.co.uk/news/business/rss.xml", category: "business" }
];

const parser = new Parser();

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
    source: "newsapi",
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
    source: "gnews",
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
          source: "economictimes",
          author: item.creator ?? null,
          publishedAt: item.isoDate ? new Date(item.isoDate) : null,
          category: feed.category
        });
      });
    } catch (e) {
      console.error(`Failed to fetch RSS ${feed}:`, e);
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
