import type { Config } from "drizzle-kit";
import * as dotenv from "dotenv";
import { resolve } from "path";

dotenv.config({ path: resolve(process.cwd(), ".env") });

export default {
  schema: "packages/db/src/schema.ts",
  out: "packages/db/migrations",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL ?? ""
  }
} satisfies Config;
