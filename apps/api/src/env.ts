import { z } from "zod";
import * as dotenv from "dotenv";
import { resolve } from "path";

// Try to find .env in current dir, or two levels up (monorepo root)
const possiblePaths = [
  resolve(process.cwd(), ".env"),
  resolve(process.cwd(), "../../.env")
];

let loaded = false;
for (const p of possiblePaths) {
  const result = dotenv.config({ path: p });
  if (!result.error) {
    console.log(`[Env] Successfully loaded .env from: ${p}`);
    loaded = true;
    break;
  }
}

if (!loaded) {
  console.warn("[Env] Could not find .env file in expected locations. Using process.env defaults.");
}

const envSchema = z.object({
  ANTHROPIC_API_KEY: z.string().min(1),
  DATABASE_URL: z.string().min(1),
  REDIS_URL: z.string().min(1),
  NEWSAPI_KEY: z.string().optional().default(""),
  GNEWS_KEY: z.string().optional().default(""),
  GROQ_API_KEY: z.string().min(1).optional(),
  GEMINI_API_KEY: z.string().min(1).optional(),
  ELEVENLABS_API_KEY: z.string().min(1).optional(),
  GROQ_VOICE_API_KEY: z.string().min(1).optional(),
  NEXTAUTH_SECRET: z.string().min(1),
  NEXT_PUBLIC_API_URL: z.string().optional(),
  PORT: z.string().optional().default("3001")
});

export const env = envSchema.parse(process.env);
