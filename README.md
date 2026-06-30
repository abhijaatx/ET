# ET AI News Briefing Platform

Live: [https://d48sqpdprdepm.cloudfront.net](https://d48sqpdprdepm.cloudfront.net)
GitHub: [https://github.com/abhijaatx/ET](https://github.com/abhijaatx/ET)

ET is a full-stack AI news platform for Economic Times-style financial news. It ingests articles, groups them into stories, generates briefings, and lets users ask AI questions grounded in the retrieved article context.

## Features

- Personalized news feed with categories, search, latest, trending, liked, and bookmarked views.
- Story briefings built from multiple related articles.
- Retrieval-grounded AI Q&A over story articles and briefing context.
- User accounts, sessions, interests, followed authors, followed stories, bookmarks, and likes.
- Vernacular article and briefing generation.
- Broadcast and text-to-speech endpoints for audio news experiences.
- On-demand article ingestion when users open the feed, with cooldowns to avoid unnecessary background cost.

## Tech Stack

- **Frontend:** Next.js 14, React, Tailwind CSS, Framer Motion.
- **API:** Node.js, TypeScript, Hono, Lucia Auth.
- **AI:** Groq LLM streaming for interactive briefing chat, with support for other provider keys through environment config.
- **Data:** PostgreSQL, pgvector, Drizzle ORM.
- **Jobs:** Redis, BullMQ workers.
- **Deployment:** AWS S3, CloudFront, EC2, Docker Compose, Caddy.

## Architecture

```text
Browser
  |
  v
CloudFront
  |-- static pages/assets --> S3 bucket with exported Next.js frontend
  |
  |-- /api/* and /health --> EC2 public DNS
                              |
                              v
                            Caddy
                              |
                              v
                         Hono API service
                          |        |
                          |        v
                          |      Redis + BullMQ
                          |        |
                          v        v
                    PostgreSQL   Worker
                                  |
                                  v
                         article ingest + AI enrichment
```

Production is intentionally low-cost:

- The frontend is a static Next.js export served from S3 through CloudFront.
- There is no production web server container for the frontend.
- CloudFront forwards only `/api/*` and `/health` to the EC2 API origin.
- One small EC2 Docker stack runs the API, worker, PostgreSQL, Redis, and Caddy.
- Scheduled ingest is disabled in production; opening the feed can trigger ingest on demand.
- Interactive AI requests are prioritized over background article processing.

## Repository Layout

```text
apps/
  api/        Hono API, auth, feed, stories, briefing, Q&A, workers
  web/        Next.js frontend
packages/
  db/         Drizzle schema, migrations, database client
deploy/
  aws/        AWS deployment scripts for EC2 and static CloudFront site
docker-compose.yml
docker-compose.prod.yml
```

## Local Development

```bash
cp .env.example .env
npm install
docker compose up --build
```

Open [http://localhost:3000](http://localhost:3000).

Required environment values:

- `NEXTAUTH_SECRET`
- `NEWSAPI_KEY` or `GNEWS_KEY`
- `GROQ_API_KEY` for AI chat and briefing features
- Database and Redis values are provided by Docker Compose for local development.

Useful commands:

```bash
npm run dev
npm run build
npm run lint
npm run db:migrate
```

## Production Deployment

The current production setup uses:

- **CloudFront:** public website entry point.
- **S3:** static Next.js frontend hosting.
- **EC2:** Docker Compose API origin.
- **Caddy:** reverse proxy for `/api/*` and `/health`.
- **PostgreSQL:** application data and article storage.
- **Redis/BullMQ:** ingest and background processing queues.

Backend deployment:

```bash
./deploy/aws/update-instance.sh <ec2-instance-id>
```

Static frontend deployment:

```bash
AWS_REGION=ap-south-1 ./deploy/aws/deploy-static-site.sh
```

Production environment is based on `.env.production.example`. Do not commit real API keys or production secrets.

## Key API Routes

- `POST /api/auth/register`, `POST /api/auth/login`, `POST /api/auth/logout`
- `GET /api/feed`, `GET /api/feed/search`, `GET /api/feed/trending`, `GET /api/feed/latest`
- `POST /api/signals`
- `GET /api/stories`, `POST /api/stories/:id/follow`, `DELETE /api/stories/:id/unfollow`
- `GET /api/briefing/:storyId`
- `POST /api/briefing/:storyId/ask`
- `GET /api/interests`
- `GET /api/authors`
- `GET /api/notifications`
- `GET /api/user/me`
- `GET /api/broadcast/generate`, `POST /api/broadcast/tts`

## Cost Strategy

- Static frontend avoids a continuously running web container.
- CloudFront caches frontend assets close to users.
- API traffic goes directly to one EC2 origin instead of using separate managed services.
- PostgreSQL and Redis run in the same Docker stack to avoid RDS and ElastiCache baseline cost.
- On-demand ingestion reduces unnecessary scheduled jobs and external API usage.
