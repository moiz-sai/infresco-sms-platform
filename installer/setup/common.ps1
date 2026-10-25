# Shared by install/uninstall/backup. Windows PowerShell 5.1 compatible.
$DataDir = Join-Path $env:ProgramData 'InfrescoSMS'
$PgData = Join-Path $DataDir 'pgdata'
$LogDir = Join-Path $DataDir 'logs'
$ConfigDir = Join-Path $DataDir 'config'
$ConfigFile = Join-Path $ConfigDir 'app.env'
$BackupDir = Join-Path $DataDir 'backups'
$UrlFile = Join-Path $DataDir 'app-url.txt'
$SheetFile = Join-Path $DataDir 'first-login.txt'
$DbService = 'InfrescoSMS-DB'
$AppService = 'InfrescoSMS-App'
$BackupTask = 'Infresco SMS daily backup'

function Write-Step([string]$msg) { Write-Host ('[{0:HH:mm:ss}] {1}' -f (Get-Date), $msg) }

# Runs a program and stops setup when it fails (native exit codes don't throw on their own).
function Invoke-Native([string]$exe, [string[]]$arguments) {
    & $exe @arguments
    if ($LASTEXITCODE -ne 0) { throw "$([IO.Path]::GetFileName($exe)) failed with exit code $LASTEXITCODE" }
}

function Wait-Until([string]$what, [int]$seconds, [scriptblock]$test) {
    for ($i = 0; $i -lt $seconds; $i++) {
        if (& $test) { return }
        Start-Sleep -Seconds 1
    }
    throw "The $what did not start within $seconds seconds"
}

function New-Secret([int]$length) {
    $chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789'.ToCharArray()
    $bytes = New-Object byte[] $length
    [Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($bytes)
    return -join ($bytes | ForEach-Object { $chars[$_ % $chars.Length] })
}

function Get-FreePort([int]$start) {
    for ($p = $start; $p -lt $start + 50; $p++) {
        $listener = New-Object Net.Sockets.TcpListener([Net.IPAddress]::Any, $p)
        try { $listener.Start(); $listener.Stop(); return $p } catch { }
    }
    throw "No free port near $start"
}

function Read-Config {
    $cfg = [ordered]@{}
    if (Test-Path $ConfigFile) {
        foreach ($line in Get-Content $ConfigFile) {
            if ($line -match '^\s*([A-Z_]+)\s*=\s*(.*)\s*$') { $cfg[$Matches[1]] = $Matches[2] }
        }
    }
    return $cfg
}

# Settings hold passwords: only Administrators and SYSTEM may read them (the services run as SYSTEM).
# The folder gets the restricted ACL and the file inherits it ((OI)(CI) flags are folder-only).
function Write-Config($cfg) {
    Invoke-Native 'icacls.exe' @($ConfigDir, '/inheritance:r', '/grant:r', '*S-1-5-32-544:(OI)(CI)F', '*S-1-5-18:(OI)(CI)F', '/Q')
    $text = ($cfg.Keys | ForEach-Object { "$_=$($cfg[$_])" }) -join "`r`n"
    [IO.File]::WriteAllText($ConfigFile, $text + "`r`n", (New-Object Text.UTF8Encoding $false))
    Invoke-Native 'icacls.exe' @($ConfigFile, '/reset', '/Q')
}

function Get-LanIPs {
    try {
        return [Net.NetworkInformation.NetworkInterface]::GetAllNetworkInterfaces() |
            Where-Object { $_.OperationalStatus -eq 'Up' -and $_.NetworkInterfaceType -ne 'Loopback' } |
            ForEach-Object { $_.GetIPProperties().UnicastAddresses } |
            Where-Object { $_.Address.AddressFamily -eq 'InterNetwork' } |
            ForEach-Object { $_.Address.IPAddressToString } |
            Where-Object { $_ -notlike '127.*' -and $_ -notlike '169.254.*' }
    } catch { return @() }
}
