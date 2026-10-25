# SPEC T10: pg_dump -Fc of the school database into backups/, keeping the newest 14.
#   powershell -ExecutionPolicy Bypass -File scripts\backup.ps1
param([int]$Keep = 14)
. "$PSScriptRoot/_common.ps1"

$envVars = Read-Env
$url = $envVars['DATABASE_ADMIN_URL']
if (-not $url) { throw 'DATABASE_ADMIN_URL is missing in apps/api/.env' }
$pgDump = Find-PgTool 'pg_dump'

$dir = Join-Path $Root 'backups'
New-Item -ItemType Directory -Force -Path $dir | Out-Null
$file = Join-Path $dir ("sms-{0}.dump" -f (Get-Date -Format 'yyyy-MM-dd_HHmmss'))

& $pgDump --format=custom --no-owner --file=$file --dbname=$url
if ($LASTEXITCODE -ne 0) {
    Remove-Item $file -ErrorAction SilentlyContinue
    throw "pg_dump failed (exit $LASTEXITCODE)"
}
$size = [math]::Round((Get-Item $file).Length / 1KB)
Write-Host "Backup saved: $file ($size KB)"

$old = Get-ChildItem $dir -Filter 'sms-*.dump' | Sort-Object Name -Descending | Select-Object -Skip $Keep
foreach ($f in $old) { Remove-Item $f.FullName; Write-Host "Removed old backup: $($f.Name)" }
