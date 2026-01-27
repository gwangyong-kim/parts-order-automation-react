#!/bin/sh
set -e

echo "==================================="
echo "PartSync MRP - Starting Application"
echo "==================================="

# Create data directories if they don't exist
mkdir -p /app/data
mkdir -p /app/data/backups

# Copy template database if database doesn't exist
if [ ! -f "/app/data/partsync.db" ]; then
    echo "Initializing database from template..."
    cp /app/data-template/partsync.db /app/data/partsync.db
    echo "Database initialized successfully!"
else
    echo "Database already exists."

    # Create startup backup (if database exists and backups are enabled)
    if [ "${BACKUP_ON_STARTUP:-true}" = "true" ]; then
        echo "Creating startup backup..."
        TIMESTAMP=$(date +%Y%m%dT%H%M%S)
        BACKUP_FILE="/app/data/backups/startup_${TIMESTAMP}.db"

        cp /app/data/partsync.db "$BACKUP_FILE"

        # Create checksum
        if command -v sha256sum > /dev/null 2>&1; then
            sha256sum "$BACKUP_FILE" | cut -d ' ' -f1 > "${BACKUP_FILE}.sha256"
        fi

        # Create metadata
        cat > "${BACKUP_FILE}.meta.json" << EOF
{
  "type": "STARTUP",
  "createdAt": "$(date -Iseconds)",
  "createdBy": "system",
  "description": "Automatic startup backup",
  "appVersion": "2.0.0"
}
EOF

        echo "Startup backup created: $BACKUP_FILE"

        # Cleanup old startup backups (keep last 5)
        STARTUP_COUNT=$(ls -1 /app/data/backups/startup_*.db 2>/dev/null | wc -l)
        if [ "$STARTUP_COUNT" -gt 5 ]; then
            echo "Cleaning up old startup backups..."
            ls -1t /app/data/backups/startup_*.db | tail -n +6 | while read -r OLD_BACKUP; do
                rm -f "$OLD_BACKUP"
                rm -f "${OLD_BACKUP}.sha256"
                rm -f "${OLD_BACKUP}.meta.json"
                echo "Deleted: $OLD_BACKUP"
            done
        fi
    fi
fi

# Run Prisma migrations if enabled
if [ "${RUN_MIGRATIONS:-false}" = "true" ]; then
    echo "Running database migrations..."
    npx prisma migrate deploy
    echo "Migrations completed!"
fi

# Verify database integrity
if [ -f "/app/data/partsync.db" ]; then
    echo "Verifying database integrity..."
    if command -v sqlite3 > /dev/null 2>&1; then
        INTEGRITY=$(sqlite3 /app/data/partsync.db "PRAGMA integrity_check;" 2>/dev/null || echo "error")
        if [ "$INTEGRITY" = "ok" ]; then
            echo "Database integrity check: PASSED"
        else
            echo "WARNING: Database integrity check failed: $INTEGRITY"
            echo "Consider restoring from a backup."
        fi
    else
        echo "SQLite3 not available, skipping integrity check."
    fi
fi

# Display startup info
echo "==================================="
echo "Environment: ${NODE_ENV:-production}"
echo "Database: /app/data/partsync.db"
echo "Backups: /app/data/backups"
echo "==================================="

# Start the application
echo "Starting Next.js server..."
exec node server.js
