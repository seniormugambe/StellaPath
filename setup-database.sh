#!/bin/bash

# Setup PostgreSQL database for Stellar DApp

echo "🔧 Setting up PostgreSQL database..."

# Create database and user
sudo -u postgres psql << EOF
-- Drop existing database if it exists (optional)
DROP DATABASE IF EXISTS stellar_dapp;
DROP USER IF EXISTS stellar_user;

-- Create database and user
CREATE DATABASE stellar_dapp;
CREATE USER stellar_user WITH PASSWORD 'stellar_password';
GRANT ALL PRIVILEGES ON DATABASE stellar_dapp TO stellar_user;
ALTER DATABASE stellar_dapp OWNER TO stellar_user;

-- Connect to the database and grant schema privileges
\c stellar_dapp
GRANT ALL ON SCHEMA public TO stellar_user;
ALTER SCHEMA public OWNER TO stellar_user;

\q
EOF

if [ $? -eq 0 ]; then
    echo "✅ Database created successfully!"
    echo ""
    echo "Database: stellar_dapp"
    echo "User: stellar_user"
    echo "Password: stellar_password"
    echo ""
    echo "Next steps:"
    echo "1. cd packages/backend"
    echo "2. npm run db:migrate"
    echo "3. npm run db:seed"
    echo "4. npm run dev"
else
    echo "❌ Failed to create database"
    exit 1
fi
