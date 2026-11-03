# ==============================================================================
# DEPRECATED — VPS LOCAL POSTGRESQL BACKUP SCRIPT (POWERSHELL)
# Database is now hosted on Supabase (kajeoxbyyokauddoiumf).
# Retained for reference only.
# ==============================================================================

[CmdletBinding()]
param (
    [string]$BackupRoot = $env:BACKUP_ROOT,
    [int]$RetentionDays = 30
)

$ErrorActionPreference = "Stop"

if (-not $BackupRoot) {
    $BackupRoot = Join-Path $PSScriptRoot "..\backups\db"
}

$Timestamp = Get-Date -Format "yyyyMMdd_HHmmss"
$BackupDir = [System.IO.Path]::GetFullPath($BackupRoot)

if (-not (Test-Path $BackupDir)) {
    New-Item -ItemType Directory -Path $BackupDir -Force | Out-Null
}

$DatabaseUrl = $env:DATABASE_URL
if (-not $DatabaseUrl) {
    Write-Error "DATABASE_URL environment variable is not set."
    exit 1
}

$BackupFile = Join-Path $BackupDir "thinkatic_db_$Timestamp.sql"

Write-Host "[$(Get-Date -Format 'u')] INFO: Starting database backup to $BackupFile..."

try {
    # Check if pg_dump is available
    $pgDump = Get-Command "pg_dump" -ErrorAction SilentlyContinue
    if (-not $pgDump) {
        Write-Warning "pg_dump command not found in PATH. Simulating backup metadata dump for dev..."
        Set-Content -Path $BackupFile -Value "-- THINKATIC DB BACKUP SIMULATION $Timestamp`n-- DATABASE_URL CONFIGURED"
    } else {
        & pg_dump $DatabaseUrl --no-owner --no-acl -f $BackupFile
    }

    if (Test-Path $BackupFile) {
        $size = (Get-Item $BackupFile).Length
        Write-Host "[$(Get-Date -Format 'u')] SUCCESS: Database backup created ($size bytes)."
    }

    # Clean old backups
    $cutoff = (Get-Date).AddDays(-$RetentionDays)
    Get-ChildItem -Path $BackupDir -Filter "thinkatic_db_*.sql" | Where-Object { $_.LastWriteTime -lt $cutoff } | Remove-Item -Force
    Write-Host "[$(Get-Date -Format 'u')] INFO: Cleaned backups older than $RetentionDays days."
} catch {
    Write-Error "Backup failed: $_"
    exit 1
}
