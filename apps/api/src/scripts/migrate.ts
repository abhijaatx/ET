import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { Pool } from "pg";
import { env } from "../env";

const pool = new Pool({ connectionString: env.DATABASE_URL });

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function run() {
  const migrationPath = path.resolve(
    __dirname,
    "../../../packages/db/migrations/0000_init.sql"
  );
  const sql = fs.readFileSync(migrationPath, "utf-8");
  await pool.query(sql);
  await pool.end();
  console.log("Migration applied");
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
