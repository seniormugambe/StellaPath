# Deployment Guide — Stellar Smart Contract DApp

This guide covers local development setup, production deployment, and operational procedures.

---

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Pre-Deployment Setup](#pre-deployment-setup)
3. [Local Development Setup](#local-development-setup)
4. [Production Deployment](#production-deployment)
5. [Environment Variable Reference](#environment-variable-reference)
6. [Database Migrations](#database-migrations)
7. [Monitoring & Logging](#monitoring--logging)
8. [Troubleshooting](#troubleshooting)

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

## Pre-Deployment Setup

Complete these steps before deploying to production (local Docker or Render).

### 1. Create production environment files

**Backend production config:**
```bash
cp packages/backend/.env.production.example packages/backend/.env.production
```

Edit `packages/backend/.env.production` and set **all required values**:

```env
# Database (use Render PostgreSQL or external managed DB)
DATABASE_URL=postgresql://user:password@host:5432/dbname

# Cache (use Render Redis or external managed Redis)
REDIS_URL=redis://:password@host:6379

# Security - generate strong random values
JWT_SECRET=your-secure-random-secret-minimum-64-characters-change-this
POSTGRES_PASSWORD=your-strong-postgres-password
REDIS_PASSWORD=your-strong-redis-password

# Server
NODE_ENV=production
PORT=3001
CORS_ORIGIN=https://your-frontend-domain.com

# Stellar Network
STELLAR_NETWORK=testnet  # or mainnet
STELLAR_HORIZON_URL=https://horizon-testnet.stellar.org
SOROBAN_RPC_URL=https://soroban-testnet.stellar.org

# Smart Contracts (populate after deployment)
ESCROW_CONTRACT_ADDRESS=CABC...
INVOICE_CONTRACT_ADDRESS=CABC...

# Email (optional, for invoice/notification emails)
SENDGRID_API_KEY=SG.your_key_here
FROM_EMAIL=noreply@your-domain.com
```

**Frontend production config:**
```bash
cp packages/frontend/.env.production.example packages/frontend/.env.production
```

Edit `packages/frontend/.env.production`:

```env
VITE_API_BASE_URL=https://your-backend-domain.com
```

### 2. Verify Docker setup

Ensure Docker and Docker Compose are installed and running:

```bash
docker --version      # Should be ≥ 24
docker compose version # Should be ≥ 2.20
```

### 3. Test local Docker build

Build and test locally before production:

```bash
# Build images
docker compose -f docker-compose.prod.yml build

# Start services (this uses the .env values from packages/backend/.env.production)
docker compose -f docker-compose.prod.yml up -d

# Verify services are healthy
docker compose -f docker-compose.prod.yml ps
# All services should show status "healthy"

# Test backend
curl http://localhost:3001/health

# Test frontend
curl http://localhost/

# Stop for now
docker compose -f docker-compose.prod.yml down
```

### 4. Prepare database

Run migrations to ensure schema is current:

```bash
cd packages/backend

# Check migration status
npm run db:migrate -- --status

# Apply any pending migrations (safe, doesn't modify existing data)
npm run db:migrate:deploy
```

### 5. Get deployment credentials

**For Docker Compose on a server:**
- SSH access to server
- Open ports 80 (HTTP), 443 (HTTPS)
- Ensure `/var/log` writable for container logs

**For Render:**
- Render account with billing enabled
- GitHub repository connected
- Render PostgreSQL and Redis services created (get connection strings)

### 6. Pre-deployment checklist

✅ **Security**
- [ ] `JWT_SECRET` is strong (64+ random chars)
- [ ] `POSTGRES_PASSWORD` and `REDIS_PASSWORD` are strong
- [ ] `.env.production` is in `.gitignore` (never commit secrets)
- [ ] Database backups configured (if applicable)

✅ **Configuration**
- [ ] `DATABASE_URL` points to production database
- [ ] `REDIS_URL` configured (or disabled if not using jobs)
- [ ] `CORS_ORIGIN` set to actual frontend domain
- [ ] `STELLAR_NETWORK` is `testnet` (for testing) or `mainnet`

✅ **Smart Contracts** (if using escrow/invoice)
- [ ] Smart contract deployed to Stellar network
- [ ] `ESCROW_CONTRACT_ADDRESS` and `INVOICE_CONTRACT_ADDRESS` set

✅ **Infrastructure**
- [ ] Render services created (Backend, Frontend, PostgreSQL), OR
- [ ] Server prepared with Docker/Docker Compose
- [ ] Firewall rules allow inbound traffic

✅ **Database**
- [ ] Test connection to production PostgreSQL
- [ ] Migrations applied (`npm run db:migrate:deploy`)
- [ ] Backup strategy in place

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

### Using Render (native services)

Render simplifies deployment with native support for Node.js, managed PostgreSQL, and managed Redis.

#### 1. Create Render services

Create three services in Render dashboard:

**A. PostgreSQL Database**
- Type: PostgreSQL
- Plan: Standard (or higher)
- Keep auto-generated connection string (add to backend env vars as `DATABASE_URL`)

**B. Redis Cache** (optional, if using background jobs)
- Type: Redis
- Plan: Standard (or higher)
- Keep connection string for backend (add as `REDIS_URL`)

**C. Backend Web Service**
- Name: `stellar-backend`
- Environment: Node
- Region: Choose closest to users
- Branch: `main`
- Build Command: `npm install && npm run build --workspace=backend && npm run db:migrate:deploy --workspace=backend`
- Start Command: `npm start --workspace=backend`
- Port: `3001` (or set via `PORT` env var)

**D. Frontend Web Service** (optional, separate from backend)
- Name: `stellar-frontend`
- Environment: Static Site (or Node)
- Branch: `main`
- Build Command: `npm install && npm run build --workspace=frontend`
- Publish Directory: `packages/frontend/dist`
- Or use Node with: `npm start --workspace=frontend` after build

#### 2. Set environment variables

In Render backend service settings, add environment variables:

**Required:**
```env
DATABASE_URL=postgresql://user:password@hostname/dbname    # From Render PostgreSQL
REDIS_URL=redis://:password@hostname:10000                  # From Render Redis (if using)
JWT_SECRET=your-secure-random-secret-64-chars-minimum

NODE_ENV=production
PORT=3001

# Stellar Network (testnet default, change to mainnet for production)
STELLAR_NETWORK=testnet
STELLAR_HORIZON_URL=https://horizon-testnet.stellar.org
SOROBAN_RPC_URL=https://soroban-testnet.stellar.org
```

**Optional (if using backend features):**
```env
SENDGRID_API_KEY=your-sendgrid-key
FROM_EMAIL=noreply@yourapp.com
LOG_LEVEL=info
CORS_ORIGIN=https://your-frontend-url.onrender.com
```

For frontend, add:
```env
VITE_API_BASE_URL=https://your-backend-url.onrender.com
```

#### 3. Connect to GitHub

1. In Render, click **New** → **Web Service**
2. Connect your GitHub repository
3. Select branch (`main`)
4. Fill in build/start commands as above
5. Add environment variables
6. Click **Create Web Service**

Render auto-deploys on `git push` to main branch.

#### 4. Verify deployment

```bash
# Test backend health
curl https://your-backend-url.onrender.com/health

# Should return:
# {"status":"ok","timestamp":"...","version":"1.0.0","environment":"production"}

# Test frontend
# Visit https://your-frontend-url.onrender.com
```

#### 5. Database migrations

Migrations run automatically via build command:
```bash
npm run db:migrate:deploy --workspace=backend
```

If manual migration needed:
```bash
# Via Render shell
npm install --workspace=backend
npx prisma migrate deploy --workspace=backend
```

---

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
| `STELLAR_ANCHOR_PROVIDER` | `stellar-ramp` | Stellar anchor/ramp provider identifier |
| `STELLAR_ANCHOR_DEPOSIT_URL` | — | Optional anchor deposit URL for ramp flows |

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

### Render-specific issues

| Issue | Cause | Solution |
|-------|-------|----------|
| Build fails with `npm: not found` | Node runtime not selected | Ensure environment is `Node` (not Static Site) |
| `DATABASE_URL` connection fails | PostgreSQL not ready or wrong URL | Check Render PostgreSQL service status; copy exact URL from dashboard |
| Health check failing (500 status) | Backend not starting | Check `PORT` env var (default `3001`); verify `DATABASE_URL` is set |
| Migrations not running | Build command incorrect | Use exact: `npm run db:migrate:deploy --workspace=backend` |
| Frontend can't reach backend | CORS/URL issue | Set `CORS_ORIGIN=https://frontend-url.onrender.com` on backend; `VITE_API_BASE_URL=https://backend-url.onrender.com` on frontend |
| Slow cold starts | Free plan limitations | Upgrade to paid plan or use cron jobs to prevent spinning down |
| `JWT_SECRET` errors on deploy | Env var not set | Add `JWT_SECRET` to Render environment variables before deploy |

**View Render logs:**
```
In Render dashboard → your service → Logs tab (real-time output)
```
