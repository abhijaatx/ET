# 📰 My ET — AI-Powered News Navigator

An AI-native news platform that aggregates articles, clusters them into stories, generates AI briefings, and delivers a personalized feed with Q&A and voice broadcasts.

---

## Table of Contents

- [Architecture Overview](#architecture-overview)
- [Tech Stack](#tech-stack)
- [Prerequisites](#prerequisites)
- [Getting Started (Local Development)](#getting-started-local-development)
  - [1. Clone the Repository](#1-clone-the-repository)
  - [2. Install Dependencies](#2-install-dependencies)
  - [3. Configure Environment Variables](#3-configure-environment-variables)
  - [4. Start Infrastructure Services](#4-start-infrastructure-services)
  - [5. Run Database Migrations](#5-run-database-migrations)
  - [6. Start the Development Servers](#6-start-the-development-servers)
- [Running with Docker (Production-like)](#running-with-docker-production-like)
- [Project Structure](#project-structure)
- [Environment Variables Reference](#environment-variables-reference)
- [API Endpoints](#api-endpoints)
- [Utility Scripts](#utility-scripts)
- [Troubleshooting](#troubleshooting)

---

## Architecture Overview

```
┌──────────────┐       ┌──────────────┐       ┌─────────────────┐
│              │       │              │       │                 │
│   Next.js    │──────▶│   Hono API   │──────▶│   PostgreSQL    │
│   Frontend   │ :3000 │   Server     │ :3001 │   (pgvector)    │
│              │       │              │       │                 │
└──────────────┘       └──────┬───────┘       └─────────────────┘
                              │
                       ┌──────┴───────┐       ┌─────────────────┐
                       │   BullMQ     │──────▶│     Redis       │
                       │   Workers    │       │                 │
                       └──────────────┘       └─────────────────┘
                              │
              ┌───────────────┼───────────────┐
              ▼               ▼               ▼
        ┌──────────┐   ┌──────────┐   ┌──────────────┐
        │  Gemini  │   │   Groq   │   │   Anthropic  │
        │  (AI)    │   │   (AI)   │   │   (AI)       │
        └──────────┘   └──────────┘   └──────────────┘
```

The platform consists of three main workspaces:

- **`apps/web`** — Next.js 14 frontend with Tailwind CSS and Framer Motion
- **`apps/api`** — Hono + TypeScript API server with BullMQ background workers
- **`packages/db`** — Drizzle ORM schema and PostgreSQL migrations (with pgvector)

Key data flows:
1. **Ingest Worker** fetches articles from NewsAPI/GNews on a 15-minute schedule
2. Articles are tagged, embedded (MiniLM via `@xenova/transformers`), and clustered into stories
3. **Story AI Worker** generates AI briefings and story arcs using multi-model fallback (Gemini → Groq → Anthropic)
4. The personalized feed uses a hybrid scoring algorithm combining topic interest, entity affinity, and vector similarity
5. Voice broadcasts are synthesized on-demand via ElevenLabs/Groq TTS

---

## Tech Stack

| Layer        | Technology                                                  |
| ------------ | ----------------------------------------------------------- |
| Frontend     | Next.js 14, React 18, Tailwind CSS 3, Framer Motion        |
| API Server   | Hono, Node.js 20, TypeScript                               |
| Database     | PostgreSQL 15 with pgvector extension                       |
| Queue        | BullMQ + Redis 7                                            |
| ORM          | Drizzle ORM                                                 |
| AI Models    | Google Gemini, Groq (Llama 3), Anthropic Claude             |
| Embeddings   | `@xenova/transformers` (all-MiniLM-L6-v2, 384-dim)         |
| Auth         | Lucia Auth v3 + Argon2 password hashing                     |
| Voice/TTS    | ElevenLabs, Groq (Orpheus)                                  |
| News Sources | NewsAPI, GNews                                              |

---

## Prerequisites

Ensure you have the following installed before proceeding:

| Tool              | Minimum Version | Check Command          |
| ----------------- | --------------- | ---------------------- |
| **Node.js**       | 20.x            | `node --version`       |
| **npm**           | 9.x             | `npm --version`        |
| **Docker**        | 24.x            | `docker --version`     |
| **Docker Compose**| 2.x             | `docker compose version` |

> **Note:** Docker is required for running PostgreSQL (with pgvector) and Redis locally. If you prefer to run Postgres and Redis natively, see the [Troubleshooting](#troubleshooting) section.

---

## Getting Started (Local Development)

### 1. Clone the Repository

```bash
git clone <your-repo-url>
cd ET
```

### 2. Install Dependencies

This is an npm workspaces monorepo. A single `npm install` at the root installs dependencies for all workspaces (`apps/api`, `apps/web`, `packages/db`):

```bash
npm install
```

### 3. Configure Environment Variables

Copy the example env file and fill in your API keys:

```bash
cp .env.example .env
```

Open `.env` in your editor and configure the **required** variables:

```dotenv
# ──── REQUIRED ──────────────────────────────────────────────

# AI Provider (at least ONE is required for briefings/story arcs)
ANTHROPIC_API_KEY=sk-ant-...          # Anthropic Claude
GEMINI_API_KEY=AIza...                # Google Gemini (recommended primary)
GROQ_API_KEY=gsk_...                  # Groq (fast Llama inference)

# Database (leave defaults for Docker Compose)
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/myet

# Redis (leave default for Docker Compose)
REDIS_URL=redis://localhost:6379

# News source (at least ONE is required for article ingestion)
NEWSAPI_KEY=<your-newsapi-key>        # Get from https://newsapi.org
GNEWS_KEY=<your-gnews-key>            # Get from https://gnews.io (optional fallback)

# Auth secret (change in production!)
NEXTAUTH_SECRET=dev-secret-change-me

# Frontend → API connection
NEXT_PUBLIC_API_URL=http://localhost:3001

# ──── OPTIONAL ──────────────────────────────────────────────

# Voice synthesis (needed for AI Broadcast feature)
ELEVENLABS_API_KEY=sk_...             # https://elevenlabs.io
GROQ_VOICE_API_KEY=gsk_...           # Groq TTS (Orpheus model)

# DNS fix for some environments
NODE_OPTIONS=--dns-result-order=ipv4first
```

### 4. Start Infrastructure Services

Start PostgreSQL (with pgvector) and Redis using Docker Compose. We use a partial `docker compose` invocation to start **only** the infrastructure services (not the app services):

```bash
docker compose up -d postgres redis
```

Verify they're running:

```bash
docker compose ps
```

You should see both `postgres` and `redis` listed as running, with ports `5432` and `6379` mapped.

### 5. Run Database Migrations

Apply the Drizzle migrations to create all tables and enable pgvector:

```bash
npm run db:migrate
```

This runs `drizzle-kit migrate` via the `packages/db` workspace, creating the following tables:
- `articles`, `stories`, `authors`, `global_broadcasts`
- `users`, `sessions`
- `article_signals`, `user_topic_interests`, `user_entity_affinity`
- `user_author_follows`, `user_story_follows`

### 6. Start the Development Servers

Start both the API and web servers concurrently:

```bash
npm run dev
```

This runs:
- **API server** at [`http://localhost:3001`](http://localhost:3001) — `tsx watch` with hot reload
- **Web frontend** at [`http://localhost:3000`](http://localhost:3000) — Next.js dev server

> The Next.js frontend proxies all `/api/*` requests to the API server via its built-in rewrites configuration, so you only need to open `http://localhost:3000` in your browser.

### ✅ You're all set!

Open [`http://localhost:3000`](http://localhost:3000) in your browser.

To trigger an immediate article ingestion (populates the feed):

```bash
npm run force-ingest --workspace apps/api
```

---

## Running with Docker (Production-like)

To run the entire stack (Postgres, Redis, API, Worker, Web) in Docker:

```bash
# Build and start all services
docker compose up --build

# Or run in detached mode
docker compose up --build -d
```

| Service    | URL / Port               | Description                    |
| ---------- | ------------------------ | ------------------------------ |
| `web`      | http://localhost:3000     | Next.js frontend               |
| `api`      | http://localhost:3001     | Hono API server                |
| `worker`   | —                        | BullMQ ingest worker (no port) |
| `postgres` | localhost:5432            | PostgreSQL + pgvector          |
| `redis`    | localhost:6379            | Redis                          |

The `api` container automatically runs database migrations on startup before starting the server.

---

## Project Structure

```
ET/
├── apps/
│   ├── api/                        # Backend API server
│   │   ├── Dockerfile
│   │   ├── package.json
│   │   └── src/
│   │       ├── index.ts            # Hono app entry point (port 3001)
│   │       ├── env.ts              # Zod-validated environment config
│   │       ├── db.ts               # Database connection
│   │       ├── redis.ts            # Redis/IORedis connection
│   │       ├── auth.ts             # Lucia Auth setup
│   │       ├── routes/             # API route handlers
│   │       │   ├── auth.ts         #   Registration, login, logout
│   │       │   ├── feed.ts         #   Personalized article feed
│   │       │   ├── stories.ts      #   Story clusters
│   │       │   ├── briefing.ts     #   AI briefing per story
│   │       │   ├── qa.ts           #   Q&A on briefings
│   │       │   ├── broadcast.ts    #   Voice broadcast
│   │       │   ├── signals.ts      #   User engagement signals
│   │       │   ├── interests.ts    #   User topic interests
│   │       │   ├── authors.ts      #   Author profiles
│   │       │   ├── notifications.ts#   User notifications
│   │       │   └── user.ts         #   User profile management
│   │       ├── services/           # Business logic layer
│   │       │   ├── anthropic.ts    #   Anthropic Claude client
│   │       │   ├── gemini.ts       #   Google Gemini client
│   │       │   ├── embeddings.ts   #   MiniLM embedding generation
│   │       │   ├── news.ts         #   NewsAPI/GNews fetcher
│   │       │   ├── scraper.ts      #   Article content scraper
│   │       │   ├── tagging.ts      #   AI topic tagging
│   │       │   ├── interest.ts     #   Interest scoring engine
│   │       │   ├── story_arc.ts    #   AI story arc generation
│   │       │   ├── briefing.ts     #   Briefing generation
│   │       │   ├── qa.ts           #   Q&A service
│   │       │   ├── vernacular.ts   #   Multi-language support
│   │       │   ├── google_voice.ts #   Google TTS
│   │       │   └── broadcast_cache.ts # Broadcast caching
│   │       ├── workers/            # Background job processors
│   │       │   ├── ingest.ts       #   Article ingestion pipeline
│   │       │   └── story-ai.ts     #   Story AI processing
│   │       └── scripts/            # Dev/admin utilities
│   │           ├── migrate.ts      #   Run DB migrations
│   │           ├── force-ingest.ts #   Manually trigger ingestion
│   │           ├── backfill-tags.ts#   Backfill missing tags
│   │           └── wipe-news.ts    #   Clear all articles
│   │
│   └── web/                        # Frontend application
│       ├── Dockerfile
│       ├── package.json
│       ├── next.config.mjs         # API proxy rewrites
│       ├── tailwind.config.ts
│       ├── app/                    # Next.js App Router pages
│       │   ├── page.tsx            #   Home feed
│       │   ├── layout.tsx          #   Root layout
│       │   ├── briefing/           #   Story briefing page
│       │   ├── broadcast/          #   AI voice broadcast
│       │   ├── explore/            #   Topic exploration
│       │   ├── search/             #   Article search
│       │   ├── bookmarks/          #   Saved articles
│       │   ├── liked/              #   Liked articles
│       │   ├── profile/            #   User profile
│       │   ├── preferences/        #   User preferences
│       │   ├── notifications/      #   Notification center
│       │   ├── login/              #   Login page
│       │   └── register/           #   Registration page
│       ├── components/             # Reusable UI components
│       └── context/                # React context providers
│
├── packages/
│   └── db/                         # Shared database package
│       ├── package.json
│       ├── drizzle.config.ts       # Drizzle Kit configuration
│       ├── src/
│       │   ├── schema.ts           # Full database schema
│       │   ├── index.ts            # Package exports
│       │   └── seed-authors.ts     # Author seed data
│       └── migrations/             # SQL migration files
│
├── docker-compose.yml              # Full-stack Docker config
├── package.json                    # Root workspace config
├── tsconfig.base.json              # Shared TypeScript config
├── .env.example                    # Environment template
└── .gitignore
```

---

## Environment Variables Reference

| Variable              | Required | Default                                  | Description                                       |
| --------------------- | -------- | ---------------------------------------- | ------------------------------------------------- |
| `ANTHROPIC_API_KEY`   | Yes*     | —                                        | Anthropic Claude API key (AI fallback)             |
| `GEMINI_API_KEY`      | Yes*     | —                                        | Google Gemini API key (primary AI)                 |
| `GROQ_API_KEY`        | Yes*     | —                                        | Groq API key (fast AI inference)                   |
| `DATABASE_URL`        | Yes      | `postgresql://postgres:postgres@localhost:5432/myet` | PostgreSQL connection string        |
| `REDIS_URL`           | Yes      | `redis://localhost:6379`                 | Redis connection string                            |
| `NEWSAPI_KEY`         | Yes†     | —                                        | NewsAPI.org API key for article ingestion           |
| `GNEWS_KEY`           | No       | —                                        | GNews.io API key (optional fallback source)         |
| `NEXTAUTH_SECRET`     | Yes      | `dev-secret-change-me`                   | Secret for session token signing                    |
| `NEXT_PUBLIC_API_URL` | Yes      | `http://localhost:3001`                  | API URL used by the frontend                        |
| `ELEVENLABS_API_KEY`  | No       | —                                        | ElevenLabs API key for voice synthesis              |
| `GROQ_VOICE_API_KEY`  | No       | —                                        | Groq TTS API key (Orpheus model)                    |
| `NODE_OPTIONS`        | No       | —                                        | Set `--dns-result-order=ipv4first` if needed        |
| `PORT`                | No       | `3001`                                   | API server port                                     |

> \* At least **one** AI provider key is required (Gemini recommended as primary).  
> † At least **one** news source key is required for the ingest pipeline to fetch articles.

---

## API Endpoints

### Authentication
| Method | Endpoint               | Auth | Description              |
| ------ | ---------------------- | ---- | ------------------------ |
| POST   | `/api/auth/register`   | No   | Create a new account     |
| POST   | `/api/auth/login`      | No   | Log in (returns session) |
| POST   | `/api/auth/logout`     | Yes  | End the session          |

### Feed & Content
| Method | Endpoint                       | Auth     | Description                        |
| ------ | ------------------------------ | -------- | ---------------------------------- |
| GET    | `/api/feed`                    | Optional | Personalized article feed          |
| GET    | `/api/stories`                 | Optional | Story clusters                     |
| GET    | `/api/briefing/:story_id`      | Optional | AI-generated story briefing        |
| POST   | `/api/briefing/:story_id/ask`  | Optional | Ask a question about a story       |

### User Engagement
| Method | Endpoint           | Auth | Description                     |
| ------ | ------------------ | ---- | ------------------------------- |
| POST   | `/api/signals`     | Yes  | Send engagement signals         |
| GET    | `/api/interests`   | Yes  | Get user topic interests        |

### Healthcheck
| Method | Endpoint   | Description          |
| ------ | ---------- | -------------------- |
| GET    | `/health`  | API health status    |

---

## Utility Scripts

Run these from the monorepo root:

```bash
# Force an immediate article ingestion cycle
npm run force-ingest --workspace apps/api

# Backfill topic tags on untagged articles
npm run backfill-tags --workspace apps/api

# Wipe all articles and stories from the database
npm run wipe-news --workspace apps/api

# Generate a new Drizzle migration after schema changes
npm run db:generate --workspace packages/db

# Apply pending database migrations
npm run db:migrate
```

---

## Troubleshooting

### Port already in use

If port 3000 or 3001 is occupied:
```bash
# Find and kill the process on a port (macOS)
lsof -ti:3000 | xargs kill -9
lsof -ti:3001 | xargs kill -9
```

### Docker containers won't start

```bash
# Remove all containers and volumes, then rebuild
docker compose down -v
docker compose up --build
```

### Database connection refused

Make sure Postgres is running and accessible:
```bash
docker compose ps                 # Check container status
docker compose logs postgres      # Check Postgres logs
```

If using a native Postgres installation (not Docker), ensure:
1. PostgreSQL 15+ is running on port 5432
2. The `pgvector` extension is installed (`CREATE EXTENSION IF NOT EXISTS vector;`)
3. A database named `myet` exists

### Redis connection refused

```bash
docker compose logs redis         # Check Redis logs
redis-cli ping                    # Should return PONG
```

### Migrations fail

```bash
# Check your DATABASE_URL is correct
echo $DATABASE_URL

# Try running migrations directly
cd packages/db && npx drizzle-kit migrate
```

### No articles appearing in the feed

The ingest pipeline must run at least once to populate the database:
```bash
npm run force-ingest --workspace apps/api
```

Make sure you have a valid `NEWSAPI_KEY` or `GNEWS_KEY` configured in `.env`.

### AI briefings not generating

At least one AI provider key must be configured. Check the API logs for errors:
```bash
# If running locally
# The terminal running `npm run dev` will show API logs

# If running in Docker
docker compose logs api
```

### `argon2` build errors on install

The `argon2` package requires native compilation. On macOS, ensure Xcode Command Line Tools are installed:
```bash
xcode-select --install
```

### `@xenova/transformers` slow on first run

The first time the embedding model loads, it downloads the MiniLM weights (~80 MB). Subsequent starts use the cached model. This is normal and only happens once.

---

## License

Private — not for redistribution.
