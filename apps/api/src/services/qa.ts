import { streamGroqCompletion, callGroq } from "./anthropic";

type ArticleContext = {
  id: string;
  title: string;
  content: string;
};

type StreamAnswerParams = {
  depthTier: string;
  articles: ArticleContext[];
  history: { role: string; content: string }[];
  question: string;
  onToken: (token: string) => Promise<void>;
  signal?: AbortSignal;
};

export async function streamAnswer(params: StreamAnswerParams) {
  const context = params.articles
    .map((a) => `[Source: ${a.id}]\nTitle: ${a.title}\nContent: ${a.content}`)
    .join("\n\n---\n\n");

  // Strict sanitization of history for Groq SDK
  const sanitizedHistory = params.history
    .filter(m => m.role === "user" || m.role === "assistant")
    .map(m => ({
      role: m.role as "user" | "assistant",
      content: m.content
    }));

  const systemPrompt = `You are a Senior Markets Correspondent at The Economic Times. 
Your goal is to provide sharp, insightful, and concise answers based EXCLUSIVELY on the provided context articles. 

Rules:
1. ONLY use the provided context. If information is missing, say: 'This specific detail isn't covered in our current ET briefing.'
2. BE CONCISE. Do not repeat facts unnecessarily. Get to the point.
3. ADAPT STYLE to depth tier:
   - 'explainer': Clear, introductory, jargon-free.
   - 'analyst': Data-focused, identifying trends and impacts.
   - 'executive': High-level strategic takeaways, 'so-what' focus.
4. NO CITATIONS: Do NOT include [source: id], source numbers, or citations of any kind. Deliver the information as a fluid narrative.
5. NO OUTSIDE KNOWLEDGE. You are a closed-system researcher for this story.
6. NO AI MENTIONS. Talk like a seasoned journalist speaking to a subscriber.`;

  const userPrompt = `Analysis Depth: ${params.depthTier}
---
[CONTEXT ARTICLES]
${context}
---
[SUBSCRIBER QUESTION]
${params.question}`;

  await callGroq(async () => {
    await streamGroqCompletion(
      systemPrompt,
      userPrompt,
      sanitizedHistory,
      params.onToken,
      params.signal
    );
  });
}
