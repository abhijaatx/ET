import { ElevenLabsClient } from "@elevenlabs/elevenlabs-js";
import * as dotenv from "dotenv";
import { resolve } from "path";
import fs from "fs";

const possiblePaths = [
  resolve(process.cwd(), ".env"),
  resolve(process.cwd(), "../../.env")
];

for (const p of possiblePaths) {
  dotenv.config({ path: p });
}

const apiKey = process.env.ELEVENLABS_API_KEY;
console.log("API Key present:", !!apiKey);
if (apiKey) console.log("API Key start:", apiKey.substring(0, 5));

const client = new ElevenLabsClient({
  apiKey: apiKey
});

async function test() {
  try {
    console.log("Attempting TTS conversion...");
    const audio = await client.textToSpeech.convert(
      "JBFqnCBsd6RMkjVDRZzb",
      {
        text: "Testing the AI delivery engine.",
        modelId: "eleven_multilingual_v2",
      }
    );
    console.log("Success! Received audio stream.");
    // We won't play it, just check if we got something
    let count = 0;
    for await (const chunk of audio as any) {
      count += chunk.length;
      if (count > 0) break;
    }
    console.log("Chunk received, size:", count);
  } catch (err) {
    console.error("Test failed:", err);
  }
}

test();
