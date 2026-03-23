import { callGroq, groqCompletion } from "./anthropic";

export type TaggedArticle = {
  topicSlugs: string[];
  entities: { id?: string; name: string; type: string; mentions?: number }[];
  articleType: "news" | "analysis" | "opinion" | "data";
  summary: string;
};

export async function tagArticle(params: {
  title: string;
  content: string;
  initialCategory?: string;
}) {
  try {
    const res = await callGroq(async () => {
      return await groqCompletion(
        "You are an expert news editor. Categorize the following article into ONE OR MORE of these high-level segments: technology, world, policy, business, markets, wealth, science. Also extract key entities and provide a 2-sentence summary. Return ONLY valid JSON.",
        `Title: ${params.title}\nContent: ${params.content.substring(0, 500)}\n\nExpected JSON format:
        {
          "topicSlugs": ["technology", "world"],
          "entities": [{"name": "Apple", "type": "company"}],
          "articleType": "news",
          "summary": "..."
        }`
      );
    });

    const parsed = JSON.parse(res) as TaggedArticle;
    
    // Enforce taxonomy and normalize slugs
    const ALLOWED_TOPICS = ["technology", "world", "policy", "business", "markets", "wealth", "science"];
    const normalizedSlugs = new Set<string>();

    parsed.topicSlugs.forEach(slug => {
      const s = slug.toLowerCase().trim();
      if (s.includes("tech")) normalizedSlugs.add("technology");
      else if (s.includes("polic") || s.includes("polit")) normalizedSlugs.add("policy");
      else if (s.includes("world") || s.includes("global") || s.includes("international")) normalizedSlugs.add("world");
      else if (s.includes("market") || s.includes("stoc")) normalizedSlugs.add("markets");
      else if (s.includes("wealth") || s.includes("finance")) normalizedSlugs.add("wealth");
      else if (s.includes("science")) normalizedSlugs.add("science");
      else if (s.includes("busines") || s.includes("economy")) normalizedSlugs.add("business");
    });

    if (params.initialCategory) {
        const s = params.initialCategory.toLowerCase().trim();
        if (ALLOWED_TOPICS.includes(s)) normalizedSlugs.add(s);
    }

    parsed.topicSlugs = Array.from(normalizedSlugs);
    if (parsed.topicSlugs.length === 0) parsed.topicSlugs.push("business");

    return parsed;
  } catch (err) {
    console.error("AI Tagging failed, falling back to keywords:", err);
    // Fallback to previous keyword logic if AI fails
    const categories = new Set<string>();
    if (params.initialCategory) categories.add(params.initialCategory);
    const text = (params.title + " " + params.content).toLowerCase();
    if (text.includes("tech")) categories.add("technology");
    if (text.includes("politics") || text.includes("policy")) categories.add("policy");
    if (text.includes("world")) categories.add("world");
    if (text.includes("stock") || text.includes("market")) categories.add("markets");
    if (categories.size === 0) categories.add("business");

    return {
      topicSlugs: Array.from(categories),
      entities: [],
      articleType: "news",
      summary: params.content.substring(0, 150) + "..."
    } satisfies TaggedArticle;
  }
}
