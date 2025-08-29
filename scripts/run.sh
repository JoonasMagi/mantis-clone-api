#!/bin/bash

# Mantis Clone SOAP Service Runner
# This script builds and runs the SOAP service

set -e  # Exit on any error

echo "🐛 Mantis Clone SOAP Service Setup"
echo "=================================="

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "❌ Error: Node.js is not installed. Please install Node.js first."
    exit 1
fi

# Check if npm is installed
if ! command -v npm &> /dev/null; then
    echo "❌ Error: npm is not installed. Please install npm first."
    exit 1
fi

echo "✅ Node.js version: $(node --version)"
echo "✅ npm version: $(npm --version)"

# Navigate to project root
cd "$(dirname "$0")/.."

# Install dependencies
echo ""
echo "📦 Installing dependencies..."
npm install

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

# Start SOAP service
echo ""
echo "🚀 Starting SOAP service..."
echo "SOAP service will be available at: http://localhost:3001/soap"
echo "WSDL will be available at: http://localhost:3001/soap?wsdl"
echo ""
echo "Press Ctrl+C to stop the service"
echo ""

# Run the SOAP server
node src/soap-server.js
