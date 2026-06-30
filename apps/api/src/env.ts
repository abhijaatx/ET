import { z } from "zod";

// On Vercel: env vars are injected directly into process.env.
// For local dev: dotenvx (configured in package.json scripts) handles .env loading.

const envSchema = z.object({
  ANTHROPIC_API_KEY: z.string().optional().default(""),
  DATABASE_URL: z.string().min(1),
  REDIS_URL: z.string().optional().default(""),
  NEWSAPI_KEY: z.string().optional().default(""),
  GNEWS_KEY: z.string().optional().default(""),
  NVIDIA_API_KEY: z.string().min(1),
  GROQ_API_KEY: z.string().optional().default(""),
  GROQ_MODEL: z.string().optional().default("llama-3.1-8b-instant"),
  GROQ_MIN_INTERVAL_MS: z.string().optional().default("25000"),
  GROQ_COOLDOWN_MS: z.string().optional().default("120000"),
  AI_REQUEST_PRIORITY: z.enum(["interactive", "background"]).optional().default("interactive"),
  INGEST_SCHEDULE_ENABLED: z.string().optional().default("true"),
  INGEST_BOOT_ENABLED: z.string().optional().default("true"),
  INGEST_WATCHDOG_ENABLED: z.string().optional().default("true"),
  INGEST_ON_DEMAND_ENABLED: z.string().optional().default("true"),
  INGEST_ON_DEMAND_COOLDOWN_MS: z.string().optional().default("900000"),
  GEMINI_API_KEY: z.string().optional().default(""),
  ELEVENLABS_API_KEY: z.string().optional().default(""),
  GROQ_VOICE_API_KEY: z.string().optional().default(""),
  NEXTAUTH_SECRET: z.string().min(1),
  NEXT_PUBLIC_API_URL: z.string().optional(),
  PORT: z.string().optional().default("3001")
});

export const env = envSchema.parse(process.env);
