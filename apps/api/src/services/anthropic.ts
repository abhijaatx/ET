import {
  BedrockRuntimeClient,
  ConverseCommand,
  ConverseStreamCommand,
  type Message,
} from "@aws-sdk/client-bedrock-runtime";
import { env } from "../env";
import { callBedrockProvider, extractJson } from "./nvidia_client";

const bedrock = new BedrockRuntimeClient({ region: env.BEDROCK_REGION });

function message(role: "user" | "assistant", content: string): Message {
  return { role, content: [{ text: content }] };
}

function responseText(content: Array<{ text?: string } | unknown> | undefined) {
  return (content ?? [])
    .map((block) => (block && typeof block === "object" && "text" in block ? String(block.text ?? "") : ""))
    .join("");
}

/** Compatibility wrapper for the existing generation call sites. */
export async function groqCompletion(
  systemPrompt: string,
  userPrompt: string,
  onHeartbeat?: () => Promise<void>
): Promise<string> {
  return callBedrockProvider(async () => {
    console.log(`[AI] Using Amazon Bedrock (${env.BEDROCK_MODEL_ID})...`);
    const result = await bedrock.send(new ConverseCommand({
      modelId: env.BEDROCK_MODEL_ID,
      system: [{ text: systemPrompt }],
      messages: [message("user", userPrompt)],
      inferenceConfig: { temperature: 0.2, maxTokens: 4096 },
    }));

    return extractJson(responseText(result.output?.message?.content));
  }, onHeartbeat);
}

/** Compatibility wrapper for the existing streaming call sites. */
export async function streamGroqCompletion(
  systemPrompt: string,
  userPrompt: string,
  history: { role: "user" | "assistant"; content: string }[],
  onToken: (token: string) => Promise<void> | void,
  signal?: AbortSignal,
  onHeartbeat?: () => Promise<void>
) {
  return callBedrockProvider(async () => {
    console.log(`[AI] Streaming Amazon Bedrock (${env.BEDROCK_MODEL_ID})...`);
    const result = await bedrock.send(new ConverseStreamCommand({
      modelId: env.BEDROCK_MODEL_ID,
      system: [{ text: systemPrompt }],
      messages: [...history.map((item) => message(item.role, item.content)), message("user", userPrompt)],
      inferenceConfig: { temperature: 0.2, maxTokens: 4096 },
    }), signal ? { abortSignal: signal } : undefined);

    for await (const event of result.stream ?? []) {
      if (signal?.aborted) break;
      const token = event.contentBlockDelta?.delta?.text;
      if (token) await onToken(token);
    }
  }, onHeartbeat);
}

// Preserve the old wrapper name used by service call sites.
export async function callGroq<T>(fn: () => Promise<T>): Promise<T> {
  return fn();
}
