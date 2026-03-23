import { Pool } from "pg";
import { env } from "../env";

const pool = new Pool({ connectionString: env.DATABASE_URL });

async function run() {
  console.log("Adding embedding column to users table...");
  try {
    await pool.query("ALTER TABLE users ADD COLUMN IF NOT EXISTS embedding vector(384)");
    console.log("Success: Column added.");
  } catch (err) {
    console.error("Error adding column:", err);
  } finally {
    await pool.end();
  }
}

run();
