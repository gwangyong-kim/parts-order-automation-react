#!/bin/sh
set -e

echo "==================================="
echo "PartSync MRP - Starting Application"
echo "==================================="

# Create data directory if it doesn't exist
mkdir -p /app/data

# Copy template database if database doesn't exist
if [ ! -f "/app/data/partsync.db" ]; then
    echo "Initializing database from template..."
    cp /app/data-template/partsync.db /app/data/partsync.db
    echo "Database initialized successfully!"
else
    echo "Database already exists."
fi

# Start the application
echo "Starting Next.js server..."
exec node server.js
