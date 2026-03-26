#!/bin/sh
set -e

echo "Running database migrations..."
NODE_TLS_REJECT_UNAUTHORIZED=0 npm run db:push

echo "Starting server..."
npm start
