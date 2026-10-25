# Checks a backup, or restores it into a NEW database (never overwrites the live one).
#   scripts\restore.ps1 -File backups\sms-....dump              # list contents only (safe)
#   scripts\restore.ps1 -File backups\sms-....dump -Into sms_restored
# To switch the school to the restored copy, change the database name in apps/api/.env.
param(
    [Parameter(Mandatory = $true)][string]$File,
    [string]$Into
)
. "$PSScriptRoot/_common.ps1"

if (-not (Test-Path $File)) { throw "Backup file not found: $File" }
$pgRestore = Find-PgTool 'pg_restore'

$items = & $pgRestore --list $File
if ($LASTEXITCODE -ne 0) { throw "Not a valid backup: $File" }
$tables = ($items | Select-String 'TABLE DATA').Count
Write-Host "Backup OK: $tables tables with data"
if (-not $Into) { return }

# Plain names only: Windows PowerShell 5.1 mangles quotes passed to native programs.
if ($Into -notmatch '^[a-z_][a-z0-9_]*$') { throw "Use a simple name like sms_restored (lowercase letters, digits, _)" }
$envVars = Read-Env
$adminUrl = $envVars['DATABASE_ADMIN_URL']
$live = ([uri]$adminUrl).AbsolutePath.TrimStart('/')
if ($Into -eq $live) { throw "Refusing to restore over the live database '$live'. Pick a new name." }
$psql = Find-PgTool 'psql'
$targetUrl = $adminUrl -replace "/$([regex]::Escape($live))(\?|$)", "/$Into`$1"

& $psql --dbname=$adminUrl -v ON_ERROR_STOP=1 -c "CREATE DATABASE $Into"
if ($LASTEXITCODE -ne 0) { throw "Could not create database $Into (does it already exist?)" }
& $pgRestore --no-owner --exit-on-error --dbname=$targetUrl $File
if ($LASTEXITCODE -ne 0) { throw "pg_restore failed (exit $LASTEXITCODE)" }
Write-Host "Restored into database '$Into'."
