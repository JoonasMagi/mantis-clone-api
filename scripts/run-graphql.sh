#!/bin/bash

# GraphQL Server Run Script for Mantis Clone API
# This script builds and starts the GraphQL server with one command

set -e  # Exit on any error

echo "🚀 Starting Mantis Clone GraphQL API Server..."
echo ""

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed. Please install Node.js first."
    exit 1
fi

# Check if npm is installed
if ! command -v npm &> /dev/null; then
    echo "❌ npm is not installed. Please install npm first."
    exit 1
fi

echo "✅ Node.js and npm are available"

# Install GraphQL dependencies if package.json exists
if [ -f "graphql-package.json" ]; then
    echo ""
    echo "📦 Installing GraphQL dependencies..."
    
    # Copy GraphQL package.json to temporary location
    cp graphql-package.json package-graphql-temp.json
    
    # Install dependencies using the GraphQL package.json
    npm install --package-lock-only=false $(cat graphql-package.json | grep -A 20 '"dependencies"' | grep -E '^\s*"[^"]+"\s*:\s*"[^"]+"' | sed 's/.*"\([^"]*\)"\s*:\s*"\([^"]*\)".*/\1@\2/' | tr '\n' ' ')
    
    # Clean up
    rm -f package-graphql-temp.json
    
    echo "✅ Dependencies installed successfully"
else
    echo "⚠️  graphql-package.json not found, assuming dependencies are already installed"
fi

# Check if database exists, if not create it by running the REST API briefly
if [ ! -f "database.sqlite" ]; then
    echo ""
    echo "🗄️  Database not found. Creating database..."
    echo "Starting REST API briefly to initialize database..."
    
    # Start REST API in background to create database
    timeout 10s npm start &
    REST_PID=$!
    
    # Wait a bit for database to be created
    sleep 5
    
    # Kill the REST API process
    kill $REST_PID 2>/dev/null || true
    wait $REST_PID 2>/dev/null || true
    
    if [ -f "database.sqlite" ]; then
        echo "✅ Database created successfully"
    else
        echo "❌ Failed to create database"
        exit 1
    fi
fi

echo ""
echo "🔧 Starting GraphQL server..."
echo ""

# Set environment variables
export GRAPHQL_PORT=4000
export NODE_ENV=development

# Start the GraphQL server
node src/graphql-server.js
