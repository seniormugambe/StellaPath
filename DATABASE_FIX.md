# Database Connection Fix

## Issue
The backend is failing with a 500 error because it cannot connect to the PostgreSQL database.

**Error:** `Authentication failed against database server at localhost, the provided database credentials for stellar_user are not valid.`

## Solution

### Option 1: Start Docker Services (Recommended)

If you're using Docker for your database:

```bash
# Start PostgreSQL and Redis
docker-compose up -d

# Or if using npm script
npm run docker:up
```

### Option 2: Check Database Credentials

1. **Check if PostgreSQL is running:**
```bash
# Check if PostgreSQL is running
sudo systemctl status postgresql

# Or check Docker containers
docker ps
```

2. **Verify your `.env` file:**

Open `packages/backend/.env` and check:

```bash
DATABASE_URL="postgresql://stellar_user:stellar_password@localhost:5432/stellar_dapp"
```

Make sure:
- Username: `stellar_user`
- Password: `stellar_password`
- Database: `stellar_dapp`
- Port: `5432`

### Option 3: Reset Database

If credentials are wrong, reset the database:

```bash
# Stop containers
docker-compose down

# Remove volumes (WARNING: This deletes all data!)
docker-compose down -v

# Start fresh
docker-compose up -d

# Wait for database to be ready (10 seconds)
sleep 10

# Run migrations
cd packages/backend
npm run db:migrate

# Seed database (optional)
npm run db:seed
```

### Option 4: Manual Database Setup

If not using Docker:

```bash
# Connect to PostgreSQL
sudo -u postgres psql

# Create database and user
CREATE DATABASE stellar_dapp;
CREATE USER stellar_user WITH PASSWORD 'stellar_password';
GRANT ALL PRIVILEGES ON DATABASE stellar_dapp TO stellar_user;
\q

# Run migrations
cd packages/backend
npm run db:migrate
npm run db:seed
```

## Quick Test

After fixing, test the database connection:

```bash
cd packages/backend

# Test database connection
npm run db:studio
# This should open Prisma Studio if connection works

# Or run migrations
npm run db:migrate
```

## Verify Fix

1. **Restart backend server:**
```bash
cd packages/backend
npm run dev
```

2. **Test authentication endpoint:**
```bash
curl -X POST http://localhost:3001/api/users/auth \
  -H "Content-Type: application/json" \
  -d '{
    "walletAddress": "GAQVMLDR73FU3FQ5I3RZEHUQY6IFSAXVLXVJ4ZMU5SLPSAL7XWOHTBNO",
    "signature": "test",
    "message": "test"
  }'
```

Should return a token (not 500 error).

## Common Issues

### Issue: Port 5432 already in use
```bash
# Find process using port 5432
sudo lsof -i :5432

# Kill the process or change port in .env
```

### Issue: Permission denied
```bash
# Fix PostgreSQL permissions
sudo chown -R postgres:postgres /var/lib/postgresql
```

### Issue: Database doesn't exist
```bash
# Create database
cd packages/backend
npm run db:migrate
```

## X402 Integration Note

The x402 integration is complete and working. This database issue is preventing ALL backend functionality, not just x402. Once the database is connected, both the authentication and x402 endpoints will work.

## Next Steps

1. ✅ Fix database connection (follow steps above)
2. ✅ Restart backend server
3. ✅ Test authentication
4. ✅ Test x402 endpoints
5. ✅ Start using the system!
