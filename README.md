# My ET + News Navigator

AI-native financial news platform with a personalized feed (My ET) and a multi-article briefing + Q&A experience (News Navigator).

## What’s inside
- **apps/api**: Hono + TypeScript API, BullMQ ingest worker, Lucia Auth
- **apps/web**: Next.js 14 frontend with Tailwind + Framer Motion
- **packages/db**: Drizzle schema + Postgres migrations (pgvector)

## Quick start (under 5 commands)
1. `git clone <your-repo-url>`
2. `cd ET`
3. `cp .env.example .env`
4. Add API keys in `.env`:
   - `ANTHROPIC_API_KEY`
   - `NEWSAPI_KEY` (provided: `3d022aeb5f60460cab013bcaac804df1`)
   - `GNEWS_KEY` (optional fallback)
5. `docker compose up --build`

Open `http://localhost:3000`.

## Notes
- News ingest runs every 15 minutes via BullMQ.
- Local embeddings use `@xenova/transformers` (MiniLM) by default.
- All DB queries use Drizzle ORM; pgvector similarity search uses raw SQL.

## API routes
- `POST /api/auth/register`
- `POST /api/auth/login`
- `POST /api/auth/logout`
- `GET /api/feed`
- `POST /api/signals`
- `GET /api/stories`
- `GET /api/briefing/:story_id`
- `POST /api/briefing/:story_id/ask`
- `GET /api/interests`
