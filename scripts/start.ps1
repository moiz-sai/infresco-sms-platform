# SPEC T10: production start on the school PC. Builds once, migrates, backs up, then serves
# the app on port 8080 for this PC and phones on the same Wi-Fi.
#   powershell -ExecutionPolicy Bypass -File scripts\start.ps1           # normal start
#   powershell -ExecutionPolicy Bypass -File scripts\start.ps1 -Build    # after updating the code
param([switch]$Build, [switch]$NoBackup)
. "$PSScriptRoot/_common.ps1"

Set-Location $Root
$main = Join-Path $ApiDir 'dist/main.js'
$web = Join-Path $Root 'apps/web/dist/index.html'
if ($Build -or -not (Test-Path $main) -or -not (Test-Path $web)) {
    Write-Host 'Building (first start or -Build)...'
    pnpm install --frozen-lockfile
    if ($LASTEXITCODE -ne 0) { throw 'pnpm install failed' }
    pnpm build
    if ($LASTEXITCODE -ne 0) { throw 'build failed' }
}

Write-Host 'Updating the database...'
pnpm --filter api db:migrate
if ($LASTEXITCODE -ne 0) { throw 'migration failed - is PostgreSQL running?' }

if (-not $NoBackup) {
    try { & "$PSScriptRoot/backup.ps1" } catch { Write-Warning "Backup skipped: $($_.Exception.Message)" }
}

$port = (Read-Env)['PORT']
if (-not $port) { $port = '8080' }
Write-Host ''
Write-Host "School office is starting. Open in a browser:"
Write-Host "  This PC:  http://localhost:$port"
foreach ($ip in Get-LanIPs) { Write-Host "  Phones:   http://${ip}:$port" }
Write-Host 'Keep this window open. Press Ctrl+C to stop.'
Write-Host ''

$env:NODE_ENV = 'production'
Set-Location $ApiDir
node dist/main.js
