import { NextRequest } from "next/server";
import { StreamingTextResponse } from "ai";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

function createTokenStream(upstream: Response) {
  const reader = upstream.body?.getReader();
  if (!reader) {
    return new ReadableStream();
  }

  const decoder = new TextDecoder();
  const encoder = new TextEncoder();

  let buffer = "";

  return new ReadableStream({
    async pull(controller) {
      const { value, done } = await reader.read();
      if (done) {
        controller.close();
        return;
      }

      buffer += decoder.decode(value, { stream: true });
      const parts = buffer.split("\n\n");
      buffer = parts.pop() ?? "";

      for (const part of parts) {
        const line = part
          .split("\n")
          .find((entry) => entry.startsWith("data:"));
        if (!line) continue;
        const data = line.replace(/^data:\s*/, "");
        if (data === "[DONE]") {
          controller.close();
          return;
        }
        controller.enqueue(encoder.encode(data));
      }
    }
  });
}

export async function POST(
  req: NextRequest,
  { params }: { params: { story_id: string } }
) {
  const body = await req.json();

  const upstream = await fetch(
    `${API_URL}/api/briefing/${params.story_id}/ask`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        cookie: req.headers.get("cookie") ?? ""
      },
      body: JSON.stringify(body)
    }
  );

  const stream = createTokenStream(upstream);
  return new StreamingTextResponse(stream);
}
