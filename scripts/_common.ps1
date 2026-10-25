# Shared helpers for start/backup/restore. Dot-source: . "$PSScriptRoot\_common.ps1"
$ErrorActionPreference = 'Stop'
$Root = Split-Path -Parent $PSScriptRoot
$ApiDir = Join-Path $Root 'apps/api'

# Reads apps/api/.env (KEY=VALUE lines) into a hashtable.
function Read-Env {
    $file = Join-Path $ApiDir '.env'
    if (-not (Test-Path $file)) { throw "Missing $file - copy apps/api/.env.example and fill it in" }
    $vars = @{}
    foreach ($line in Get-Content $file) {
        if ($line -match '^\s*([A-Z_]+)\s*=\s*(.*)\s*$') { $vars[$Matches[1]] = $Matches[2].Trim('"') }
    }
    return $vars
}

# Finds a PostgreSQL client tool on PATH, or in the default Windows install folder (newest version).
function Find-PgTool([string]$name) {
    $cmd = Get-Command $name -ErrorAction SilentlyContinue
    if ($cmd) { return $cmd.Source }
    $base = Join-Path $env:ProgramFiles 'PostgreSQL'
    if ($env:ProgramFiles -and (Test-Path $base)) {
        $found = Get-ChildItem $base -Directory | Sort-Object { [int]($_.Name -replace '\D', '') } -Descending |
            ForEach-Object { Join-Path $_.FullName "bin/$name.exe" } | Where-Object { Test-Path $_ } | Select-Object -First 1
        if ($found) { return $found }
    }
    throw "$name not found. Install PostgreSQL 18 or add its bin folder to PATH."
}

# LAN addresses phones can use (IPv4, not loopback/link-local).
function Get-LanIPs {
    try {
        return [System.Net.NetworkInformation.NetworkInterface]::GetAllNetworkInterfaces() |
            Where-Object { $_.OperationalStatus -eq 'Up' } |
            ForEach-Object { $_.GetIPProperties().UnicastAddresses } |
            Where-Object { $_.Address.AddressFamily -eq 'InterNetwork' } |
            ForEach-Object { $_.Address.IPAddressToString } |
            Where-Object { $_ -notlike '127.*' -and $_ -notlike '169.254.*' }
    } catch { return @() }
}
