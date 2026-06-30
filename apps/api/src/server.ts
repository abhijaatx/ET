import { serve } from "@hono/node-server";
import { env } from "./env";
import app from "./app";

process.on("unhandledRejection", (reason, promise) => {
  console.error("Unhandled Rejection at:", promise, "reason:", reason);
});

process.on("uncaughtException", (err) => {
  console.error("Uncaught Exception:", err);
});

serve({
  fetch: app.fetch,
  port: Number(env.PORT)
});

console.log(`API listening on ${env.PORT}`);
