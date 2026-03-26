#!/bin/sh
set -e

echo "Running database migrations..."
npm run db:push || echo "Warning: db:push failed, continuing with startup..."

echo "Starting server..."
npm start
