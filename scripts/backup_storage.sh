#!/usr/bin/env bash
# ==============================================================================
# DEPRECATED — VPS LOCAL STORAGE BACKUP SCRIPT
# Storage is now authoritative in Supabase Storage private buckets (kajeoxbyyokauddoiumf).
# Retained for reference only.
# ==============================================================================

set -euo pipefail

TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
STORAGE_ROOT="${STORAGE_ROOT:-/srv/thinkatic/storage}"
BACKUP_ROOT="${BACKUP_ROOT:-/srv/thinkatic/backups/storage}"
RETENTION_DAYS="${STORAGE_BACKUP_RETENTION_DAYS:-14}"

if [ ! -d "$STORAGE_ROOT" ]; then
    echo "[$(date -u)] ERROR: STORAGE_ROOT directory '$STORAGE_ROOT' does not exist." >&2
    exit 1
fi

mkdir -p "$BACKUP_ROOT"
chmod 700 "$BACKUP_ROOT"

BACKUP_FILE="${BACKUP_ROOT}/thinkatic_storage_${TIMESTAMP}.tar.gz"
TEMP_FILE="${BACKUP_FILE}.tmp"

echo "[$(date -u)] INFO: Starting persistent storage snapshot for ${STORAGE_ROOT}..."

# Create compressed tar archive
if tar -czf "$TEMP_FILE" -C "$(dirname "$STORAGE_ROOT")" "$(basename "$STORAGE_ROOT")"; then
    mv "$TEMP_FILE" "$BACKUP_FILE"
    chmod 600 "$BACKUP_FILE"
    FILE_SIZE=$(du -h "$BACKUP_FILE" | cut -f1)
    echo "[$(date -u)] SUCCESS: Storage snapshot created at ${BACKUP_FILE} (${FILE_SIZE})"
else
    echo "[$(date -u)] ERROR: Failed to create storage tar archive!" >&2
    rm -f "$TEMP_FILE"
    exit 1
fi

# Clean up snapshots older than RETENTION_DAYS
echo "[$(date -u)] INFO: Cleaning up storage snapshots older than ${RETENTION_DAYS} days..."
find "$BACKUP_ROOT" -type f -name "thinkatic_storage_*.tar.gz" -mtime +"$RETENTION_DAYS" -exec rm -f {} +

echo "[$(date -u)] INFO: Storage backup completed cleanly."
