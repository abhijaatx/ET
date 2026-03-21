import { callAnthropic, anthropic } from "./anthropic";

export type ChatMessage = { role: "user" | "assistant"; content: string };

type StreamEvent = {
  type?: string;
  delta?: { type?: string; text?: string };
};

function isTextDelta(event: StreamEvent): event is Required<StreamEvent> {
  return (
    event.type === "content_block_delta" &&
    event.delta?.type === "text_delta" &&
    typeof event.delta.text === "string"
  );
}

export async function streamAnswer(params: {
  depthTier: string;
  articles: { id: string; title: string; content: string }[];
  history: ChatMessage[];
  question: string;
  signal?: AbortSignal;
  onToken: (token: string) => Promise<void> | void;
}) {
  const context = params.articles
    .map(
      (article) =>
        `Article ${article.id}\nTitle: ${article.title}\nContent: ${article.content}`
    )
    .join("\n\n");

  await callAnthropic(async () => {
    const stream = (await anthropic.messages.stream({
      model: "claude-sonnet-4-6",
      max_tokens: 1000,
      temperature: 0.2,
      system:
        "You are an expert financial journalist. Every factual claim must include [source: article_id]. Never use information not present in the provided articles. If the question cannot be answered from the articles, respond: 'I can't find that in the ET coverage of this story.' and then add what can be said instead with citations.",
      messages: [
        {
          role: "user",
          content: `User depth tier: ${params.depthTier}\n\n${context}`
        },
        ...params.history,
        {
          role: "user",
          content: params.question
        }
      ]
    })) as AsyncIterable<StreamEvent> & { controller?: AbortController };

    for await (const event of stream) {
      if (params.signal?.aborted) {
        stream.controller?.abort();
        break;
      }

      const typed = event as StreamEvent;
      if (isTextDelta(typed)) {
        await params.onToken(typed.delta.text);
      }
    }
  });
}
