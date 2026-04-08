# Docker Setup Guide

## Current Situation

You have PostgreSQL already running as a system service on port 5432, which conflicts with Docker.

## Option 1: Use System PostgreSQL (Recommended - Faster)

Since PostgreSQL is already running, let's use it instead of Docker:

### Step 1: Create Database and User

```bash
# Connect to PostgreSQL
sudo -u postgres psql

# Run these commands in psql:
CREATE DATABASE stellar_dapp;
CREATE USER stellar_user WITH PASSWORD 'stellar_password';
GRANT ALL PRIVILEGES ON DATABASE stellar_dapp TO stellar_user;
ALTER DATABASE stellar_dapp OWNER TO stellar_user;
\q
```

### Step 2: Start Only Redis in Docker

```bash
# Start just Redis (not PostgreSQL)
docker compose up -d redis

# Check it's running
docker ps
```

### Step 3: Update .env (if needed)

Your `.env` should already have:
```bash
DATABASE_URL="postgresql://stellar_user:stellar_password@localhost:5432/stellar_dapp"
REDIS_URL="redis://localhost:6379"
```

### Step 4: Run Migrations

```bash
cd packages/backend
npm run db:migrate
npm run db:seed
```

### Step 5: Start Backend

```bash
npm run dev
```

---

## Option 2: Use Docker PostgreSQL

If you prefer Docker for everything:

### Step 1: Stop System PostgreSQL

```bash
# Stop PostgreSQL service
sudo systemctl stop postgresql

# Prevent it from starting on boot (optional)
sudo systemctl disable postgresql
```

### Step 2: Start Docker Services

```bash
# Start both PostgreSQL and Redis
docker compose up -d postgres redis

# Wait for services to be ready
sleep 10

# Check they're running
docker ps
```

### Step 3: Run Migrations

```bash
cd packages/backend
npm run db:migrate
npm run db:seed
```

### Step 4: Start Backend

```bash
npm run dev
```

---

## Quick Commands

### Check Docker Status
```bash
docker ps                          # Running containers
docker compose ps                  # Project containers
docker logs stellar-dapp-postgres  # PostgreSQL logs
docker logs stellar-dapp-redis     # Redis logs
```

### Stop Services
```bash
docker compose down                # Stop all
docker compose down -v             # Stop and remove volumes (deletes data!)
```

### Restart Services
```bash
docker compose restart postgres
docker compose restart redis
```

### View Logs
```bash
docker compose logs -f postgres    # Follow PostgreSQL logs
docker compose logs -f redis       # Follow Redis logs
```

---

## Troubleshooting

### Port Already in Use

If you get "port already in use":

```bash
# Check what's using the port
sudo lsof -i :5432  # PostgreSQL
sudo lsof -i :6379  # Redis

# Stop system services
sudo systemctl stop postgresql
sudo systemctl stop redis
```

### Database Connection Failed

```bash
# Check if containers are running
docker ps

# Check container logs
docker logs stellar-dapp-postgres

# Restart containers
docker compose restart postgres
```

### Permission Denied

```bash
# Add your user to docker group
sudo usermod -aG docker $USER

# Log out and back in, or run:
newgrp docker
```

---

## Recommended: Option 1

I recommend **Option 1** (use system PostgreSQL) because:
- ✅ PostgreSQL is already running
- ✅ Faster (no Docker overhead)
- ✅ Less resource usage
- ✅ One less thing to manage

Just start Redis in Docker and use system PostgreSQL!
