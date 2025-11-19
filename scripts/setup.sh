#!/bin/bash

# YesNo.Win Monorepo Setup Script
# Run this after cloning the repository

set -e

echo "🚀 Setting up YesNo.Win monorepo..."

# Check prerequisites
echo ""
echo "📋 Checking prerequisites..."

if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed. Please install Node.js >= 18"
    exit 1
fi

if ! command -v pnpm &> /dev/null; then
    echo "❌ pnpm is not installed. Installing pnpm..."
    npm install -g pnpm
fi

if ! command -v forge &> /dev/null; then
    echo "⚠️  Foundry is not installed. Install it for smart contract development:"
    echo "   curl -L https://foundry.paradigm.xyz | bash"
    echo "   foundryup"
fi

echo "✅ Prerequisites check complete"

# Install dependencies
echo ""
echo "📦 Installing dependencies..."
pnpm install

# Build packages
echo ""
echo "🔨 Building packages..."
echo "Note: Contracts need to be built first before SDK types can be generated"

# Try to build contracts (may fail if Foundry not installed)
if command -v forge &> /dev/null; then
    echo "Building contracts..."
    pnpm --filter contracts build || echo "⚠️  Contract build failed (this is OK if you don't have Foundry yet)"
else
    echo "⚠️  Skipping contract build (Foundry not installed)"
fi

# Generate SDK types
echo "Generating SDK types..."
pnpm --filter sdk build || echo "⚠️  SDK build may have warnings (normal if contracts aren't compiled yet)"

# Build utils
echo "Building utils..."
pnpm --filter utils build

echo ""
echo "✅ Setup complete!"
echo ""
echo "📝 Next steps:"
echo "   1. Copy .env.example to .env and fill in your values"
echo "   2. Get a Thirdweb Client ID from https://thirdweb.com/dashboard"
echo "   3. Run 'pnpm dev' to start the development server"
echo ""
echo "📚 Useful commands:"
echo "   pnpm dev              - Start frontend dev server"
echo "   pnpm build:contracts  - Build smart contracts"
echo "   pnpm test:contracts   - Run contract tests"
echo "   pnpm build:sdk        - Generate SDK types from contracts"
echo ""
echo "Happy building! 🎉"

