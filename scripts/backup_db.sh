#!/usr/bin/env bash
# ==============================================================================
# DEPRECATED — VPS LOCAL POSTGRESQL BACKUP SCRIPT
# Database is now hosted on Supabase (kajeoxbyyokauddoiumf).
# Retained for reference only.
# ==============================================================================

set -euo pipefail

TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
BACKUP_ROOT="${BACKUP_ROOT:-/srv/thinkatic/backups/db}"
RETENTION_DAYS="${BACKUP_RETENTION_DAYS:-30}"

# Load environment variables if .env exists
if [ -f "/srv/thinkatic/app/.env" ]; then
    # shellcheck disable=SC1091
    source /srv/thinkatic/app/.env
elif [ -f "./.env" ]; then
    # shellcheck disable=SC1091
    source ./.env
fi

DATABASE_URL="${DATABASE_URL:-}"

if [ -z "$DATABASE_URL" ]; then
    echo "[$(date -u)] ERROR: DATABASE_URL is not set. Cannot perform backup." >&2
    exit 1
fi

mkdir -p "$BACKUP_ROOT"
chmod 700 "$BACKUP_ROOT"

BACKUP_FILE="${BACKUP_ROOT}/thinkatic_db_${TIMESTAMP}.sql.gz"
TEMP_FILE="${BACKUP_FILE}.tmp"

echo "[$(date -u)] INFO: Starting Thinkatic PostgreSQL database backup..."

# Execute pg_dump and pipe through gzip
if pg_dump "$DATABASE_URL" --no-owner --no-acl | gzip -9 > "$TEMP_FILE"; then
    mv "$TEMP_FILE" "$BACKUP_FILE"
    chmod 600 "$BACKUP_FILE"
    FILE_SIZE=$(du -h "$BACKUP_FILE" | cut -f1)
    echo "[$(date -u)] SUCCESS: Database backup created successfully at ${BACKUP_FILE} (${FILE_SIZE})"
else
    echo "[$(date -u)] ERROR: pg_dump failed!" >&2
    rm -f "$TEMP_FILE"
    exit 1
fi

# Verify backup is not empty
if [ ! -s "$BACKUP_FILE" ]; then
    echo "[$(date -u)] ERROR: Generated backup file is empty (0 bytes)!" >&2
    exit 1
fi

# Apply retention policy: remove backups older than RETENTION_DAYS
echo "[$(date -u)] INFO: Cleaning up database backups older than ${RETENTION_DAYS} days..."
find "$BACKUP_ROOT" -type f -name "thinkatic_db_*.sql.gz" -mtime +"$RETENTION_DAYS" -exec rm -f {} +

echo "[$(date -u)] INFO: Database backup completed cleanly."
