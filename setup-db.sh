#!/bin/bash
# Complete Prisma setup script for Job Board Aggregator

echo "===== Starting Complete DB Setup ====="

# Set the DATABASE_URL environment variable for Azure PostgreSQL
export DATABASE_URL="db-url?sslmode=require"
echo "DATABASE_URL has been set for this session"

# Save to .env files for persistence
echo "DATABASE_URL=\"$DATABASE_URL\"" > ./DB/.env
echo "DATABASE_URL=\"$DATABASE_URL\"" > ./scraper/transferToDb/.env

# Setup DB directory
echo "===== Setting up DB directory ====="
cd DB
npm install
npx prisma generate

# Create symbolic link to schema.prisma in transferToDb directory
echo "===== Setting up TransferToDb directory ====="
mkdir -p ../scraper/transferToDb/prisma
cp ./prisma/schema.prisma ../scraper/transferToDb/prisma/
cd ../scraper/transferToDb
npm install 
npx prisma generate

# Return to root
cd ../../

# Install dependencies for the main scraper
echo "===== Setting up Scraper directory ====="
cd scraper
npm install
cd ..

echo "===== Setup completed! ====="
echo "Testing Prisma connection..."

# Test the Prisma connection
cd DB
node -e "const { PrismaClient } = require('@prisma/client'); const prisma = new PrismaClient(); async function test() { try { await prisma.\$connect(); console.log('✅ Connection successful!'); } catch (e) { console.error('❌ Connection failed:', e); } finally { await prisma.\$disconnect(); } } test();"
cd ..

echo "===== You can now run: node universal-import.js --run-all ====="