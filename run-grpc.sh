#!/bin/bash

# Mantis Clone gRPC Server - Build and Run Script
# This script compiles proto files, installs dependencies, and starts the gRPC server

set -e  # Exit on any error

echo "🚀 Mantis Clone gRPC Server Setup"
echo "=================================="

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed. Please install Node.js 16+ and try again."
    exit 1
fi

# Check if npm is installed
if ! command -v npm &> /dev/null; then
    echo "❌ npm is not installed. Please install npm and try again."
    exit 1
fi

echo "✅ Node.js version: $(node --version)"
echo "✅ npm version: $(npm --version)"

# Create necessary directories
echo "📁 Creating directories..."
mkdir -p generated
mkdir -p logs

# Install dependencies using the gRPC-specific package.json
echo "📦 Installing dependencies..."
if [ -f "grpc-package.json" ]; then
    cp grpc-package.json package.json
    npm install
    echo "✅ Dependencies installed successfully"
else
    echo "❌ grpc-package.json not found!"
    exit 1
fi

# Check if protoc is available (for proto compilation)
if command -v protoc &> /dev/null; then
    echo "✅ protoc found: $(protoc --version)"
    
    # Compile proto files
    echo "🔧 Compiling proto files..."
    npm run proto:compile 2>/dev/null || echo "⚠️  Proto compilation failed, but server can still run with proto-loader"
else
    echo "⚠️  protoc not found. Using @grpc/proto-loader for runtime compilation."
fi

# Check if the database exists, if not copy from the REST API
if [ ! -f "mantis.db" ]; then
    echo "🗄️  Database not found. Checking for existing database..."
    if [ -f "mantis.db" ]; then
        echo "✅ Database found"
    else
        echo "⚠️  No existing database found. Server will create tables on first run."
    fi
fi

# Set environment variables
export GRPC_PORT=${GRPC_PORT:-50051}
export NODE_ENV=${NODE_ENV:-development}

echo ""
echo "🌟 Starting gRPC Server..."
echo "Port: $GRPC_PORT"
echo "Environment: $NODE_ENV"
echo ""
echo "To stop the server, press Ctrl+C"
echo ""

# Start the server
node src/grpc-server.js
