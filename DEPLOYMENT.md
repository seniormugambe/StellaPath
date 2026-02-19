# Deployment Guide — Stellar Smart Contract DApp

This guide covers local development setup, production deployment, and operational procedures.

---

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Local Development Setup](#local-development-setup)
3. [Production Deployment](#production-deployment)
4. [Environment Variable Reference](#environment-variable-reference)
5. [Database Migrations](#database-migrations)
6. [Monitoring & Logging](#monitoring--logging)
7. [Troubleshooting](#troubleshooting)

---

## Prerequisites

| Tool | Version | Purpose |
|------|---------|---------|
| **Node.js** | ≥ 20 LTS | Backend & frontend runtime |
| **npm** | ≥ 9 | Package management |
| **Docker** | ≥ 24 | Container runtime |
| **Docker Compose** | ≥ 2.20 | Multi-container orchestration |
| **Rust** | ≥ 1.74 (optional) | Soroban smart contract compilation |
| **Soroban CLI** | ≥ 20 (optional) | Smart contract deployment |
| **Git** | ≥ 2.40 | Version control |

---

## Local Development Setup

### 1. Clone the repository

```bash
git clone <repository-url>
cd stellar-smart-contract-dapp
```

### 2. Start infrastructure services

Docker Compose provides PostgreSQL and Redis for local development:

```bash
docker compose up -d
```

This starts:
- **PostgreSQL 15** on port `5432` (user: `stellar_user`, password: `stellar_password`, db: `stellar_dapp`)
- **Redis 7** on port `6379`

Optional GUI tools (pgAdmin on `:8080`, Redis Commander on `:8081`):

```bash
docker compose --profile tools up -d
```

### 3. Install dependencies

```bash
# Root workspace
npm install

# Backend
cd packages/backend
npm install

# Frontend
cd ../frontend
npm install
```

### 4. Configure environment

```bash
# Backend — copy the example and edit as needed
cp packages/backend/.env.production.example packages/backend/.env
```

Minimal `.env` for local development:

```env
DATABASE_URL="postgresql://stellar_user:stellar_password@localhost:5432/stellar_dapp"
REDIS_URL="redis://localhost:6379"
JWT_SECRET=local-dev-secret-change-in-production
PORT=3001
NODE_ENV=development
STELLAR_NETWORK=testnet
STELLAR_HORIZON_URL=https://horizon-testnet.stellar.org
SOROBAN_RPC_URL=https://soroban-testnet.stellar.org
CORS_ORIGIN=http://localhost:3000
```

### 5. Set up the database

```bash
cd packages/backend

# Generate Prisma client
npm run db:generate

# Run migrations
npm run db:migrate

# (Optional) Seed sample data
npm run db:seed
```

### 6. Start development servers

```bash
# Backend (port 3001)
cd packages/backend
npm run dev

# Frontend (port 3000) — in a separate terminal
cd packages/frontend
npm run dev
```

### 7. Verify

- Backend health: [http://localhost:3001/health](http://localhost:3001/health)
- API docs (Swagger UI): [http://localhost:3001/api/docs](http://localhost:3001/api/docs)
- Frontend: [http://localhost:3000](http://localhost:3000)

---

## Production Deployment

### Using Docker Compose (recommended)

#### 1. Prepare environment file

```bash
cp packages/backend/.env.production.example .env
```

Edit `.env` and set **all required values** — at minimum:

```env
POSTGRES_PASSWORD=<strong-random-password>
REDIS_PASSWORD=<strong-random-password>
JWT_SECRET=<strong-random-secret>
```

See the [Environment Variable Reference](#environment-variable-reference) for the full list.

#### 2. Build and start

```bash
docker compose -f docker-compose.prod.yml up -d --build
```

This starts four services:
| Service | Port | Description |
|---------|------|-------------|
| `postgres` | 5432 | PostgreSQL database |
| `redis` | 6379 | Redis cache & queue |
| `backend` | 3001 | Express API server |
| `frontend` | 80 | Nginx serving React SPA |

#### 3. Run database migrations

```bash
docker compose -f docker-compose.prod.yml exec backend npx prisma migrate deploy
```

#### 4. Verify health

```bash
curl http://localhost:3001/health
```

#### 5. Stop services

```bash
docker compose -f docker-compose.prod.yml down
```

To also remove volumes (⚠️ destroys data):

```bash
docker compose -f docker-compose.prod.yml down -v
```

### CI/CD Pipeline

The project includes a GitHub Actions workflow (`.github/workflows/ci.yml`) that runs on pushes and PRs to `main`:

1. **Lint** — ESLint for backend and frontend
2. **Test Backend** — Jest tests with PostgreSQL and Redis service containers
3. **Build** — TypeScript compilation and frontend build
4. **Docker Build** — Verifies Docker images build (main branch only)

---

## Environment Variable Reference

### Required

| Variable | Description | Example |
|----------|-------------|---------|
| `DATABASE_URL` | PostgreSQL connection string | `postgresql://user:pass@host:5432/db` |
| `REDIS_URL` | Redis connection string | `redis://:password@host:6379` |
| `JWT_SECRET` | Secret key for JWT signing | Random 64+ character string |
| `POSTGRES_PASSWORD` | PostgreSQL password (Docker) | Strong random password |
| `REDIS_PASSWORD` | Redis password (Docker prod) | Strong random password |

### Server

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `3001` | Backend server port |
| `NODE_ENV` | `development` | Environment (`development`, `production`, `test`) |
| `CORS_ORIGIN` | `http://localhost:3000` | Allowed CORS origin |
| `RATE_LIMIT_WINDOW_MS` | `900000` | Rate limit window (ms) |
| `RATE_LIMIT_MAX_REQUESTS` | `100` | Max requests per window |
| `LOG_LEVEL` | `info` | Logging level (`debug`, `info`, `warn`, `error`) |

### Stellar Network

| Variable | Default | Description |
|----------|---------|-------------|
| `STELLAR_NETWORK` | `testnet` | Network (`testnet` or `mainnet`) |
| `STELLAR_HORIZON_URL` | `https://horizon-testnet.stellar.org` | Horizon API URL |
| `STELLAR_PASSPHRASE` | Test SDF passphrase | Network passphrase |
| `SOROBAN_RPC_URL` | `https://soroban-testnet.stellar.org` | Soroban RPC URL |

### JWT

| Variable | Default | Description |
|----------|---------|-------------|
| `JWT_SECRET` | — | **Required.** Signing secret |
| `JWT_EXPIRES_IN` | `24h` | Token expiration |

### Email / Notifications

| Variable | Default | Description |
|----------|---------|-------------|
| `SENDGRID_API_KEY` | — | SendGrid API key (optional) |
| `FROM_EMAIL` | `noreply@stellar-dapp.com` | Sender email address |
| `FROM_NAME` | `Stellar DApp` | Sender display name |
| `FRONTEND_URL` | `http://localhost:3000` | Frontend URL for email links |
| `CLIENT_PORTAL_URL` | `http://localhost:3000/client` | Client portal URL |

### Background Jobs

| Variable | Default | Description |
|----------|---------|-------------|
| `CONDITION_CHECK_INTERVAL` | `300000` | Escrow condition check interval (ms) |
| `INVOICE_EXPIRATION_CHECK_INTERVAL` | `3600000` | Invoice expiration check interval (ms) |
| `TRANSACTION_SYNC_INTERVAL` | `60000` | Transaction status sync interval (ms) |

### Docker Compose Port Overrides

| Variable | Default | Description |
|----------|---------|-------------|
| `FRONTEND_PORT` | `80` | Frontend exposed port |
| `BACKEND_PORT` | `3001` | Backend exposed port |
| `POSTGRES_PORT` | `5432` | PostgreSQL exposed port |
| `REDIS_PORT` | `6379` | Redis exposed port |

---

## Database Migrations

### Development

```bash
cd packages/backend

# Create a new migration after schema changes
npm run db:migrate

# Reset database (⚠️ destroys data)
npm run db:migrate:reset

# Open Prisma Studio (GUI)
npm run db:studio
```

### Production

```bash
# Apply pending migrations (non-destructive)
npx prisma migrate deploy

# Or via Docker
docker compose -f docker-compose.prod.yml exec backend npx prisma migrate deploy
```

### Custom migrations

```bash
npm run db:migrate:custom
```

---

## Monitoring & Logging

### Logs

The backend uses **Winston** for structured JSON logging.

```bash
# Docker logs
docker compose -f docker-compose.prod.yml logs -f backend

# Tail specific service
docker compose -f docker-compose.prod.yml logs -f --tail=100 backend
```

Set `LOG_LEVEL` to control verbosity (`debug`, `info`, `warn`, `error`).

### Health Checks

All Docker services include health checks. View status:

```bash
docker compose -f docker-compose.prod.yml ps
```

The backend exposes `GET /health` which returns:

```json
{
  "status": "ok",
  "timestamp": "2025-01-01T00:00:00.000Z",
  "version": "1.0.0",
  "environment": "production"
}
```

### Database monitoring

```bash
# Check active connections
docker compose -f docker-compose.prod.yml exec postgres \
  psql -U stellar_user -d stellar_dapp -c "SELECT count(*) FROM pg_stat_activity;"
```

### Redis monitoring

```bash
docker compose -f docker-compose.prod.yml exec redis redis-cli -a $REDIS_PASSWORD INFO
```

---

## Troubleshooting

### Backend won't start

| Symptom | Cause | Fix |
|---------|-------|-----|
| `ECONNREFUSED :5432` | PostgreSQL not ready | Wait for health check or run `docker compose up -d postgres` |
| `JWT_SECRET not configured` | Missing env var | Set `JWT_SECRET` in `.env` |
| `Prisma client not generated` | Missing build step | Run `npm run db:generate` |

### Database issues

```bash
# Check if PostgreSQL is running
docker compose ps postgres

# View PostgreSQL logs
docker compose logs postgres

# Connect directly
docker compose exec postgres psql -U stellar_user -d stellar_dapp
```

### Redis connection errors

```bash
# Verify Redis is running
docker compose exec redis redis-cli ping
# Expected: PONG

# In production (with password)
docker compose -f docker-compose.prod.yml exec redis redis-cli -a $REDIS_PASSWORD ping
```

### Port conflicts

If default ports are in use, override them in `.env`:

```env
POSTGRES_PORT=5433
REDIS_PORT=6380
BACKEND_PORT=3002
FRONTEND_PORT=8080
```

### Docker build failures

```bash
# Clean rebuild
docker compose -f docker-compose.prod.yml build --no-cache

# Prune unused images
docker system prune -f
```

### Migration failures

```bash
# Check migration status
cd packages/backend
npx prisma migrate status

# If stuck, reset (⚠️ development only)
npm run db:migrate:reset
```
