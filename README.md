# ForgeCI

A production-inspired CI/CD platform built from scratch. Define pipelines in YAML, push to GitHub, and watch your steps execute in real time inside isolated Docker containers — with live log streaming straight to the browser.

Inspired by GitHub Actions. Built to understand what happens under the hood.

---

## What it does

- **GitHub OAuth login** — authenticate with your GitHub account
- **YAML pipeline definitions** — define named steps, Docker images, and shell commands
- **Automatic webhook registration** — ForgeCI registers a push webhook on your repo when you create a pipeline
- **Asynchronous job execution** — every push enqueues a job via BullMQ; a worker picks it up and runs it
- **Dockerized step execution** — each step runs in its own container with a shared workspace volume
- **Live log streaming** — Socket.io + Redis pub/sub streams logs to the browser line-by-line as they happen
- **Run history** — view past runs, per-step status, and persisted logs
- **BullBoard** — queue monitoring UI at `/admin/queues`

---

## Architecture

```
Browser (React + Vite)
    │
    │  REST API (pipelines, runs, auth)
    │  Socket.io (live log streaming)
    ▼
Express Server  ──►  PostgreSQL (Prisma ORM)
    │
    │  enqueue job
    ▼
BullMQ Queue  ──►  Redis
    │
    │  dequeue job
    ▼
Pipeline Worker
    │
    ├──►  Docker: alpine/git  (clone repo into shared volume)
    ├──►  Docker: <step image> (run step 1 command)
    ├──►  Docker: <step image> (run step 2 command)
    └──►  Redis pub/sub  ──►  Socket.io  ──►  Browser (live logs)
```

**Stack:** React · Vite · Node.js · Express · PostgreSQL · Prisma · BullMQ · Redis · Docker · Socket.io · GitHub OAuth

---

## Pipeline YAML format

```yaml
name: My Pipeline

steps:
  - name: Install dependencies
    image: node:20-alpine
    run: npm ci

  - name: Run tests
    image: node:20-alpine
    run: npm test

  - name: Build
    image: node:20-alpine
    run: npm run build
```

`image` is any Docker image — the worker pulls it automatically.  
`run` is the shell command executed inside that container against the cloned repo.

---

## Local development setup

### Prerequisites

- Node.js 18+
- Docker (running)
- PostgreSQL
- Redis

### 1. Clone the repo

```bash
git clone https://github.com/opinder8699/ForgeCI.git
cd ForgeCI
```

### 2. Backend

```bash
cd backend
cp .env.example .env
# Fill in all values in .env (see comments in the file)

npm install
npx prisma migrate deploy
npx prisma generate
npm run dev
```

### 3. Frontend

```bash
cd frontend
# Create .env.local with:
# VITE_API_URL=http://localhost:5000

npm install
npm run dev
```

### 4. Expose webhooks locally (required for push triggers)

GitHub needs a public URL to send push events to. Use ngrok:

```bash
ngrok http 5000
# Copy the https URL and set it in backend/.env:
# WEBHOOK_URL=https://xxxx.ngrok.io/api/webhooks/github
```

### Generate secrets

```bash
# JWT_SECRET (64-byte hex)
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"

# ENCRYPTION_KEY (32-byte hex = 64 chars)
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# GITHUB_WEBHOOK_SECRET (any random string)
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

---

## Environment variables


| Variable | Description |
|---|---|
| `DATABASE_URL` | PostgreSQL connection string |
| `REDIS_URL` | Redis connection string |
| `GITHUB_CLIENT_ID` | GitHub OAuth App client ID |
| `GITHUB_CLIENT_SECRET` | GitHub OAuth App client secret |
| `WEBHOOK_URL` | Public URL GitHub sends push events to |
| `GITHUB_WEBHOOK_SECRET` | Used to verify webhook signatures |
| `JWT_SECRET` | Signs session cookies |
| `ENCRYPTION_KEY` | AES-256 key for storing GitHub tokens (64 hex chars) |
| `FRONTEND_URL` | React app origin — used for CORS and OAuth redirect |

---

## Key technical decisions

**Why BullMQ + Redis instead of running jobs in-process?**  
Pipeline execution is long-running and blocking. Putting it in a queue means the HTTP layer stays responsive, failed jobs can be retried with backoff, and the worker can run independently (separate process or service).

**Why Redis pub/sub for live logs instead of SSE or polling?**  
The worker runs in a separate process (different Node.js event loop from the HTTP server). Redis pub/sub is the clean boundary — the worker publishes to a channel per run, and the Socket.io layer subscribes and forwards to the connected browser.

**Why per-step Docker containers instead of a single container?**  
Each step can use a different image (e.g. `node:20` for build, `python:3.12` for tests). Isolation also prevents step state from leaking between steps. Shared workspace is a Docker named volume mounted into each container.

**Why encrypt GitHub access tokens?**  
The tokens are stored in PostgreSQL. If the DB is ever compromised, raw tokens would give read/write access to users' repos. AES-256-CBC encryption with a key that lives only in env vars limits the blast radius.

---

## API overview

| Method | Route | Description |
|---|---|---|
| `GET` | `/api/auth/github` | Start GitHub OAuth flow |
| `GET` | `/api/auth/github/callback` | OAuth callback, sets cookie |
| `GET` | `/api/auth/me` | Get current user |
| `POST` | `/api/auth/logout` | Clear session cookie |
| `GET` | `/api/pipelines` | List user's pipelines |
| `POST` | `/api/pipelines` | Create pipeline + register webhook |
| `GET` | `/api/pipelines/:id` | Get pipeline + runs |
| `PUT` | `/api/pipelines/:id` | Update pipeline |
| `DELETE` | `/api/pipelines/:id` | Delete pipeline + deregister webhook |
| `GET` | `/api/runs/:id` | Get run with steps and logs |
| `DELETE` | `/api/runs/:id` | Delete a run |
| `POST` | `/api/webhooks/github` | GitHub push event handler (HMAC verified) |
| `GET` | `/admin/queues` | BullBoard queue monitor |

---

## Project structure

```
ForgeCI/
├── backend/
│   ├── server.js              # Entry point — HTTP server + worker bootstrap
│   ├── app.js                 # Express app, middleware, routes
│   ├── prisma/
│   │   └── schema.prisma      # DB schema (User, Pipeline, PipelineRun, PipelineStep)
│   └── src/
│       ├── config/redis.js    # Separated BullMQ vs regular Redis connections
│       ├── middlewares/auth.js
│       ├── modules/
│       │   ├── auth/          # GitHub OAuth, JWT, /me
│       │   ├── pipeline/      # CRUD + webhook registration
│       │   ├── runs/          # Run history + deletion
│       │   ├── webhook/       # Push event handler → enqueue job
│       │   ├── queue/         # BullMQ queue instance
│       │   ├── workers/       # Pipeline worker — clone + execute steps
│       │   └── bullboard/     # BullBoard UI setup
│       ├── socket/socket.js   # Socket.io server + Redis subscriber
│       └── utils/
│           ├── executeStep.js
│           ├── parsePipeline.js
│           ├── validatePipeline.js
│           ├── registerWebhook.js
│           ├── deleteWebhook.js
│           ├── encryption.js
│           └── verifyGithubSignature.js
└── frontend/
    └── src/
        ├── pages/             # Dashboard, PipelineDetails, RunDetails, Login, CreatePipeline
        ├── components/        # Navbar
        ├── context/           # AuthContext
        ├── api/axios.js       # Axios instance with base URL + credentials
        └── routes/            # AppRoutes, ProtectedRoute
```