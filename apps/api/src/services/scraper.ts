import * as cheerio from "cheerio";
import { groqCompletion, callGroq } from "./anthropic";
import { RawArticle } from "./news";

export async function scrapeTechCrunch(): Promise<RawArticle[]> {
  try {
    const res = await fetch("https://techcrunch.com/", {
      headers: {
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
      }
    });
    if (!res.ok) return [];
    const html = await res.text();
    const $ = cheerio.load(html);
    
    const articles: RawArticle[] = [];
    $("article").each((_, el) => {
      const title = $(el).find("h2").text().trim();
      const url = $(el).find("h2 a").attr("href");
      const content = $(el).find("p").first().text().trim();
      // TechCrunch featured image or loop card image
      const imageUrl = $(el).find("img").attr("src") || $(el).find("img").attr("data-src");
      
      if (title && url) {
        articles.push({
          externalId: url,
          title,
          content: content || title,
          url,
          imageUrl: imageUrl || null,
          source: "techcrunch",
          author: null,
          publishedAt: new Date(),
          category: "technology"
        });
      }
    });

    return articles;
  } catch (e) {
    console.error("Scrape TechCrunch failed:", e);
    return [];
  }
}

export async function scrapeETTech(): Promise<RawArticle[]> {
  try {
    const res = await fetch("https://economictimes.indiatimes.com/tech", {
      headers: {
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
      }
    });
    if (!res.ok) return [];
    const html = await res.text();
    const $ = cheerio.load(html);
    
    const articles: RawArticle[] = [];
    // ET Tech layout often uses .eachStory or similar
    $(".eachStory").each((_, el) => {
      const title = $(el).find("h3, h2").text().trim();
      const url = $(el).find("a").attr("href");
      const imageUrl = $(el).find("img").attr("src") || $(el).find("img").attr("data-original");
      const absUrl = url?.startsWith("http") ? url : `https://economictimes.indiatimes.com${url}`;
      
      if (title && url) {
        articles.push({
          externalId: absUrl,
          title,
          content: title,
          url: absUrl,
          imageUrl: imageUrl || null,
          source: "economictimes",
          author: null,
          publishedAt: new Date(),
          category: "technology"
        });
      }
    });
    
    return articles;
  } catch (e) {
    return [];
  }
}

export async function deepScrapeArticle(url: string, source: string): Promise<string | null> {
  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
      }
    });
    if (!res.ok) return null;
    const html = await res.text();
    const $ = cheerio.load(html);

    // Clean up typical noise
    $("script, style, iframe, .ad-box, .newsletter-signup").remove();

    let content = "";

    if (source === "economictimes" || url.includes("economictimes.indiatimes.com")) {
      content = $(".artText, .article-body, [data-section=\"article-body\"]").text().trim();
    } else if (source === "techcrunch" || url.includes("techcrunch.com")) {
      content = $(".article-content, .entry-content, .wp-block-post-content").find("p").text().trim();
    } else if (url.includes("reuters.com")) {
      content = $(".article-body__content__17Yit, [data-testid=\"paragraph-0\"]").parent().text().trim();
    } else if (url.includes("bloomberg.com")) {
      content = $(".body-copy, .article-body").text().trim();
    }

    // Generic fallback: all paragraphs in main/article or just all p
    if (!content) {
      content = $("article p, main p").text().trim();
    }
    if (!content) {
      content = $("p").text().trim();
    }

    // Clean up: remove excessive whitespace
    return content.replace(/\s+/g, " ").substring(0, 5000) || null;
  } catch (e) {
    console.error(`Deep scrape failed for ${url}:`, e);
    return null;
  }
}

async function parseWithAI(html: string, sourceKey: string): Promise<RawArticle[]> {
  const text = html.replace(/<script\b[^>]*>([\s\S]*?)<\/script>/gim, "")
                   .replace(/<style\b[^>]*>([\s\S]*?)<\/style>/gim, "")
                   .replace(/<[^>]*>?/gm, "")
                   .substring(0, 4000); 

  const systemPrompt = `Extract news articles from the text. 
Return ONLY a JSON array of objects with fields: title, url, snippet, image_url. 
The URL and image_url must be absolute. 
Start your response with [ and end with ]. No other text.`;

  const userPrompt = `Source: ${sourceKey}\nText: ${text}`;
  
  try {
    const jsonStr = await callGroq(() => groqCompletion(systemPrompt, userPrompt));
    // Robust JSON extraction
    const match = jsonStr.match(/\[\s*{[\s\S]*}\s*\]/);
    if (!match) throw new Error("No JSON array found in AI response");
    
    const raw = JSON.parse(match[0]) as any[];
    return raw.map(a => ({
      externalId: a.url,
      title: a.title,
      content: a.snippet || "",
      url: a.url,
      imageUrl: a.image_url || null,
      source: sourceKey as any,
      author: null,
      publishedAt: new Date(),
      category: "technology"
    }));
  } catch (e) {
    console.error(`AI Scraper parsing failed for ${sourceKey}:`, e);
    return [];
  }
}
