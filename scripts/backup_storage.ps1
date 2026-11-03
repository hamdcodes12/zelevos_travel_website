# ==============================================================================
# DEPRECATED — VPS LOCAL STORAGE BACKUP SCRIPT (POWERSHELL)
# Storage is now authoritative in Supabase Storage private buckets (kajeoxbyyokauddoiumf).
# Retained for reference only.
# ==============================================================================

[CmdletBinding()]
param (
    [string]$StorageRoot = $env:STORAGE_ROOT,
    [string]$BackupRoot = $env:BACKUP_ROOT,
    [int]$RetentionDays = 14
)

$ErrorActionPreference = "Stop"

if (-not $StorageRoot) {
    $StorageRoot = Join-Path $PSScriptRoot "..\data\storage"
}
if (-not $BackupRoot) {
    $BackupRoot = Join-Path $PSScriptRoot "..\backups\storage"
}

$Timestamp = Get-Date -Format "yyyyMMdd_HHmmss"
$StorageDir = [System.IO.Path]::GetFullPath($StorageRoot)
$BackupDir = [System.IO.Path]::GetFullPath($BackupRoot)

if (-not (Test-Path $StorageDir)) {
    Write-Host "[$(Get-Date -Format 'u')] WARN: Storage directory $StorageDir does not exist yet. Creating empty directory..."
    New-Item -ItemType Directory -Path $StorageDir -Force | Out-Null
}

if (-not (Test-Path $BackupDir)) {
    New-Item -ItemType Directory -Path $BackupDir -Force | Out-Null
}

$ZipFile = Join-Path $BackupDir "thinkatic_storage_$Timestamp.zip"

Write-Host "[$(Get-Date -Format 'u')] INFO: Archiving storage from $StorageDir to $ZipFile..."

try {
    Compress-Archive -Path "$StorageDir\*" -DestinationPath $ZipFile -Force
    $size = (Get-Item $ZipFile).Length
    Write-Host "[$(Get-Date -Format 'u')] SUCCESS: Storage backup archive created ($size bytes)."

    # Retention cleanup
    $cutoff = (Get-Date).AddDays(-$RetentionDays)
    Get-ChildItem -Path $BackupDir -Filter "thinkatic_storage_*.zip" | Where-Object { $_.LastWriteTime -lt $cutoff } | Remove-Item -Force
    Write-Host "[$(Get-Date -Format 'u')] INFO: Cleaned archives older than $RetentionDays days."
} catch {
    Write-Error "Storage backup failed: $_"
    exit 1
}
