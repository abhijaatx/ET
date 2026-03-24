import { z } from "zod";
import * as dotenv from "dotenv";
import { resolve } from "path";

const envPath = resolve(process.cwd(), "../../.env");
console.log(`[Env] Loading .env from: ${envPath}`);
dotenv.config({ path: envPath });
// Fallback to local .env if root is not found (though dev runs from root-workspace)
dotenv.config();

const envSchema = z.object({
  ANTHROPIC_API_KEY: z.string().min(1),
  DATABASE_URL: z.string().min(1),
  REDIS_URL: z.string().min(1),
  NEWSAPI_KEY: z.string().optional().default(""),
  GNEWS_KEY: z.string().optional().default(""),
  GROQ_API_KEY: z.string().min(1).optional(),
  GEMINI_API_KEY: z.string().min(1).optional(),
  NEXTAUTH_SECRET: z.string().min(1),
  NEXT_PUBLIC_API_URL: z.string().optional(),
  PORT: z.string().optional().default("3001")
});

export const env = envSchema.parse(process.env);
