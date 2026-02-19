#!/usr/bin/env tsx

import { execSync } from 'child_process';
import { existsSync } from 'fs';
import path from 'path';

const PRISMA_DIR = path.join(__dirname, '../../prisma');
const MIGRATIONS_DIR = path.join(PRISMA_DIR, 'migrations');

async function runMigrations() {
  console.log('🔄 Starting database migration process...');

  try {
    // Check if migrations directory exists
    if (!existsSync(MIGRATIONS_DIR)) {
      console.log('📁 Creating migrations directory...');
      execSync('mkdir -p prisma/migrations', { cwd: path.join(__dirname, '../..') });
    }

    // Check if this is the first migration
    const isFirstMigration = !existsSync(path.join(MIGRATIONS_DIR, 'migration_lock.toml'));

    if (isFirstMigration) {
      console.log('🆕 Running initial migration...');
      execSync('npx prisma migrate dev --name init', { 
        cwd: path.join(__dirname, '../..'),
        stdio: 'inherit'
      });
    } else {
      console.log('🔄 Running pending migrations...');
      execSync('npx prisma migrate dev', { 
        cwd: path.join(__dirname, '../..'),
        stdio: 'inherit'
      });
    }

    console.log('✅ Database migrations completed successfully!');

    // Generate Prisma client
    console.log('🔄 Generating Prisma client...');
    execSync('npx prisma generate', { 
      cwd: path.join(__dirname, '../..'),
      stdio: 'inherit'
    });

    console.log('✅ Prisma client generated successfully!');

  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  }
}

async function resetDatabase() {
  console.log('🔄 Resetting database...');

  try {
    execSync('npx prisma migrate reset --force', { 
      cwd: path.join(__dirname, '../..'),
      stdio: 'inherit'
    });

    console.log('✅ Database reset completed successfully!');
  } catch (error) {
    console.error('❌ Database reset failed:', error);
    process.exit(1);
  }
}

async function deployMigrations() {
  console.log('🔄 Deploying migrations to production...');

  try {
    execSync('npx prisma migrate deploy', { 
      cwd: path.join(__dirname, '../..'),
      stdio: 'inherit'
    });

    console.log('✅ Production migrations deployed successfully!');
  } catch (error) {
    console.error('❌ Production migration deployment failed:', error);
    process.exit(1);
  }
}

// Command line interface
const command = process.argv[2];

switch (command) {
  case 'dev':
  case 'migrate':
    runMigrations();
    break;
  case 'reset':
    resetDatabase();
    break;
  case 'deploy':
    deployMigrations();
    break;
  default:
    console.log('Usage: tsx migrate.ts [dev|reset|deploy]');
    console.log('  dev    - Run development migrations');
    console.log('  reset  - Reset database and run all migrations');
    console.log('  deploy - Deploy migrations to production');
    process.exit(1);
}