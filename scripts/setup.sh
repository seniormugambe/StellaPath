#!/bin/bash

# Stellar Smart Contract DApp Setup Script
# This script helps set up the development environment

set -e

echo "🚀 Setting up Stellar Smart Contract DApp development environment..."

# Check if required tools are installed
check_tool() {
    if ! command -v $1 &> /dev/null; then
        echo "❌ $1 is not installed. Please install it first."
        exit 1
    else
        echo "✅ $1 is installed"
    fi
}

echo "📋 Checking required tools..."
check_tool node
check_tool npm
check_tool docker
check_tool docker-compose

# Check Node.js version
NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 18 ]; then
    echo "❌ Node.js version 18 or higher is required. Current version: $(node -v)"
    exit 1
fi

echo "✅ Node.js version is compatible: $(node -v)"

# Install dependencies
echo "📦 Installing dependencies..."
npm install

# Copy environment files if they don't exist
echo "⚙️ Setting up environment files..."

if [ ! -f "packages/backend/.env" ]; then
    cp packages/backend/.env.example packages/backend/.env
    echo "✅ Created packages/backend/.env"
else
    echo "ℹ️ packages/backend/.env already exists"
fi

if [ ! -f "packages/frontend/.env" ]; then
    cp packages/frontend/.env.example packages/frontend/.env
    echo "✅ Created packages/frontend/.env"
else
    echo "ℹ️ packages/frontend/.env already exists"
fi

if [ ! -f "packages/contracts/.env" ]; then
    cp packages/contracts/.env.example packages/contracts/.env
    echo "✅ Created packages/contracts/.env"
else
    echo "ℹ️ packages/contracts/.env already exists"
fi

# Create logs directory
mkdir -p packages/backend/logs
echo "✅ Created logs directory"

# Start Docker services
echo "🐳 Starting Docker services..."
docker-compose up -d

# Wait for services to be ready
echo "⏳ Waiting for services to be ready..."
sleep 10

# Check if services are running
if docker-compose ps | grep -q "Up"; then
    echo "✅ Docker services are running"
else
    echo "❌ Some Docker services failed to start"
    docker-compose logs
    exit 1
fi

echo ""
echo "🎉 Setup complete! Your development environment is ready."
echo ""
echo "📍 Available services:"
echo "   - Frontend: http://localhost:3000"
echo "   - Backend API: http://localhost:3001"
echo "   - PostgreSQL: localhost:5432"
echo "   - Redis: localhost:6379"
echo ""
echo "🚀 To start development:"
echo "   npm run dev"
echo ""
echo "🔧 To access database tools:"
echo "   docker-compose --profile tools up -d"
echo "   - pgAdmin: http://localhost:8080"
echo "   - Redis Commander: http://localhost:8081"
echo ""
echo "📚 For more information, see README.md"