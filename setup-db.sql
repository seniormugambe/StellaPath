-- Setup script for Stellar DApp database
-- Run with: sudo -u postgres psql -f setup-db.sql

-- Create database
CREATE DATABASE stellar_dapp;

-- Create user
CREATE USER stellar_user WITH PASSWORD 'stellar_password';

-- Grant privileges
GRANT ALL PRIVILEGES ON DATABASE stellar_dapp TO stellar_user;
ALTER DATABASE stellar_dapp OWNER TO stellar_user;

-- Connect to database and grant schema privileges
\c stellar_dapp
GRANT ALL ON SCHEMA public TO stellar_user;
ALTER SCHEMA public OWNER TO stellar_user;
