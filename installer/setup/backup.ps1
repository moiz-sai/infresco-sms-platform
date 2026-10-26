# Daily backup (scheduled task, runs as SYSTEM) and on demand. Keeps the newest 14 in
# C:\ProgramData\InfrescoSMS\backups. If a USB drive has a folder "InfrescoSMS-Backups", the new
# backup is copied there too. Windows PowerShell 5.1 compatible.
param([string]$AppDir = (Split-Path -Parent $PSScriptRoot), [int]$Keep = 14)
$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot 'common.ps1')

$cfg = Read-Config
if (-not $cfg['DATABASE_ADMIN_URL']) { throw "Settings not found in $ConfigFile" }
New-Item -ItemType Directory -Force -Path $BackupDir | Out-Null
$file = Join-Path $BackupDir ('sms-{0}.dump' -f (Get-Date -Format 'yyyy-MM-dd_HHmmss'))
& (Join-Path $AppDir 'pgsql\bin\pg_dump.exe') --format=custom --no-owner "--file=$file" "--dbname=$($cfg['DATABASE_ADMIN_URL'])"
if ($LASTEXITCODE -ne 0) {
    Remove-Item $file -ErrorAction SilentlyContinue
    throw "pg_dump failed (exit $LASTEXITCODE)"
}
Write-Host "Backup saved: $file"

Get-ChildItem $BackupDir -Filter 'sms-*.dump' | Sort-Object Name -Descending |
    Select-Object -Skip $Keep | ForEach-Object { Remove-Item $_.FullName }

# Off-PC copy: any removable drive that has an InfrescoSMS-Backups folder.
try {
    foreach ($drive in [IO.DriveInfo]::GetDrives()) {
        if ($drive.DriveType -ne 'Removable' -or -not $drive.IsReady) { continue }
        $target = Join-Path $drive.RootDirectory.FullName 'InfrescoSMS-Backups'
        if (Test-Path $target) { Copy-Item $file $target; Write-Host "Copied to $target" }
    }
} catch { Write-Host "USB copy skipped: $($_.Exception.Message)" }
