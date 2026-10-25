# Runs once at install (and again on upgrade) as Administrator, called by the Inno Setup installer.
# Creates the database, settings, services, firewall rule and daily backup. Safe to re-run: an
# existing installation keeps its data, passwords and ports.
# Windows PowerShell 5.1 compatible (no ?? / ternary / pwsh-only cmdlets).
param(
    [string]$AppDir = (Split-Path -Parent $PSScriptRoot),
    [switch]$DemoData
)
$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot 'common.ps1')

New-Item -ItemType Directory -Force -Path $DataDir, $LogDir, $ConfigDir, $BackupDir | Out-Null
Start-Transcript -Path (Join-Path $LogDir 'install.log') -Append | Out-Null
try {
    Write-Step "Infresco SMS setup, app folder: $AppDir"
    $pgBin = Join-Path $AppDir 'pgsql\bin'
    $node = Join-Path $AppDir 'node\node.exe'
    $api = Join-Path $AppDir 'app\api'

    # ---------- settings (kept on upgrade)
    $cfg = Read-Config
    $isNew = $cfg.Count -eq 0
    if ($isNew) {
        Write-Step 'New installation: choosing ports and generating passwords'
        $pgPort = Get-FreePort 5433
        $appPort = Get-FreePort 8080
        $pgPass = New-Secret 24
        $appPass = New-Secret 24
        if ($DemoData) { $initialPw = 'Admin@123'; $initialPin = '1234' }
        else { $initialPw = 'Sms-' + (New-Secret 8); $initialPin = [string](Get-Random -Minimum 1000 -Maximum 9999) }
        $cfg = [ordered]@{
            DATABASE_URL       = "postgres://sms_app:$appPass@localhost:$pgPort/sms"
            DATABASE_ADMIN_URL = "postgres://postgres:$pgPass@localhost:$pgPort/sms"
            PORT               = "$appPort"
            SESSION_SECRET     = (New-Secret 48)
            DEVICE_PREFIX      = 'D1'
        }
    } else {
        Write-Step 'Existing installation found: keeping its data, passwords and ports'
        $pgPort = ([uri]$cfg['DATABASE_ADMIN_URL']).Port
        $pgPass = [uri]::UnescapeDataString(([uri]$cfg['DATABASE_ADMIN_URL']).UserInfo.Split(':')[1])
        $appPort = $cfg['PORT']
    }

    # ---------- database cluster + Windows service
    if (-not (Test-Path (Join-Path $PgData 'PG_VERSION'))) {
        Write-Step "Creating the database cluster in $PgData"
        New-Item -ItemType Directory -Force -Path $PgData | Out-Null
        $pwFile = Join-Path $env:TEMP ('sms-pw-' + [guid]::NewGuid() + '.txt')
        [IO.File]::WriteAllText($pwFile, $pgPass)
        try {
            Invoke-Native (Join-Path $pgBin 'initdb.exe') @('-D', $PgData, '-U', 'postgres', "--pwfile=$pwFile",
                '-E', 'UTF8', '--locale=C', '--auth=scram-sha-256')
        } finally { Remove-Item $pwFile -Force -ErrorAction SilentlyContinue }
        Add-Content -Path (Join-Path $PgData 'postgresql.conf') -Value @(
            '', '# Infresco SMS', "port = $pgPort", "listen_addresses = 'localhost'")
    }
    # The database service runs as NETWORK SERVICE (well-known SID, works in every Windows language).
    Invoke-Native 'icacls.exe' @($PgData, '/grant', '*S-1-5-20:(OI)(CI)F', '/T', '/Q')
    if (-not (Get-Service $DbService -ErrorAction SilentlyContinue)) {
        Write-Step 'Registering the database service'
        Invoke-Native (Join-Path $pgBin 'pg_ctl.exe') @('register', '-N', $DbService, '-U', 'NT AUTHORITY\NetworkService',
            '-D', $PgData, '-S', 'auto', '-w')
        Invoke-Native 'sc.exe' @('description', $DbService, 'Infresco SMS database (PostgreSQL)')
        Invoke-Native 'sc.exe' @('failure', $DbService, 'reset=', '3600', 'actions=', 'restart/5000/restart/10000/restart/30000')
    }
    Start-Service $DbService
    Wait-Until 'database' 90 { & (Join-Path $pgBin 'pg_isready.exe') -h localhost -p $pgPort -q; $LASTEXITCODE -eq 0 }

    $env:PGPASSWORD = $pgPass
    $exists = & (Join-Path $pgBin 'psql.exe') -h localhost -p $pgPort -U postgres -d postgres -tAc "SELECT 1 FROM pg_database WHERE datname = 'sms'"
    if ("$exists".Trim() -ne '1') {
        Write-Step 'Creating database "sms"'
        Invoke-Native (Join-Path $pgBin 'psql.exe') @('-h', 'localhost', '-p', "$pgPort", '-U', 'postgres', '-d', 'postgres',
            '-v', 'ON_ERROR_STOP=1', '-c', 'CREATE DATABASE sms')
    }
    Remove-Item Env:PGPASSWORD

    if ($isNew) { Write-Config $cfg }
    if (-not (Test-Path -LiteralPath $ConfigFile)) {
        Get-ChildItem -Force $ConfigDir | Format-Table -AutoSize | Out-String | Write-Host
        & icacls.exe $ConfigDir | Write-Host
        throw "Settings file was not created: $ConfigFile"
    }

    # ---------- schema, school, users (and demo data)
    $env:SMS_ENV_FILE = $ConfigFile
    $env:NODE_ENV = 'production'
    Push-Location $api
    try {
        Write-Step 'Updating the database structure'
        Invoke-Native $node @('dist\db\migrate.js')
        if ($isNew) { $env:SMS_INITIAL_PASSWORD = $initialPw; $env:SMS_INITIAL_PIN = $initialPin }
        Write-Step 'Creating the school and the principal/clerk users'
        Invoke-Native $node @('dist\db\seed.js')
        if ($DemoData) {
            Write-Step 'Loading demo data (300 students, takes about a minute)'
            Invoke-Native $node @('dist\db\seed-demo.js')
        }
    } finally {
        Pop-Location
        Remove-Item Env:SMS_INITIAL_PASSWORD, Env:SMS_INITIAL_PIN -ErrorAction SilentlyContinue
    }

    # ---------- app service (WinSW wraps node.exe; restarts on crash, starts at boot)
    $svcExe = Join-Path $AppDir 'service\InfrescoSMS-App.exe'
    $svcXml = [IO.Path]::ChangeExtension($svcExe, '.xml')
    $xml = @"
<service>
  <id>$AppService</id>
  <name>Infresco SMS</name>
  <description>Infresco SMS school office system (web app on port $appPort)</description>
  <executable>$node</executable>
  <arguments>dist\main.js</arguments>
  <workingdirectory>$api</workingdirectory>
  <env name="SMS_ENV_FILE" value="$ConfigFile"/>
  <env name="NODE_ENV" value="production"/>
  <startmode>Automatic</startmode>
  <depend>$DbService</depend>
  <onfailure action="restart" delay="5 sec"/>
  <onfailure action="restart" delay="10 sec"/>
  <onfailure action="restart" delay="30 sec"/>
  <resetfailure>1 hour</resetfailure>
  <logpath>$LogDir</logpath>
  <log mode="roll-by-size"><sizeThreshold>10240</sizeThreshold><keepFiles>5</keepFiles></log>
</service>
"@
    if (Get-Service $AppService -ErrorAction SilentlyContinue) {
        Write-Step 'Updating the app service'
        Stop-Service $AppService -Force -ErrorAction SilentlyContinue
        & $svcExe uninstall | Out-Null
        Start-Sleep -Seconds 2
    }
    [IO.File]::WriteAllText($svcXml, $xml, (New-Object Text.UTF8Encoding $false))
    Write-Step 'Registering the app service'
    Invoke-Native $svcExe @('install')
    Start-Service $AppService
    Wait-Until 'web app' 120 {
        try { (Invoke-RestMethod -Uri "http://localhost:$appPort/api/health" -TimeoutSec 3).status -eq 'ok' } catch { $false }
    }

    # ---------- phones on the school Wi-Fi (all profiles: school networks are often marked Public)
    Write-Step "Opening port $appPort in Windows Firewall"
    Get-NetFirewallRule -Name 'InfrescoSMS' -ErrorAction SilentlyContinue | Remove-NetFirewallRule
    New-NetFirewallRule -Name 'InfrescoSMS' -DisplayName 'Infresco SMS' -Direction Inbound -Action Allow `
        -Protocol TCP -LocalPort $appPort -Profile Any | Out-Null

    # ---------- daily backup at 14:00 (runs later if the PC was off), keeps 14
    Write-Step 'Scheduling the daily backup'
    $action = New-ScheduledTaskAction -Execute 'powershell.exe' `
        -Argument "-NoProfile -ExecutionPolicy Bypass -File `"$(Join-Path $AppDir 'setup\backup.ps1')`" -AppDir `"$AppDir`""
    $trigger = New-ScheduledTaskTrigger -Daily -At '14:00'
    $settings = New-ScheduledTaskSettingsSet -StartWhenAvailable -ExecutionTimeLimit (New-TimeSpan -Hours 1)
    $principal = New-ScheduledTaskPrincipal -UserId 'S-1-5-18' -LogonType ServiceAccount -RunLevel Highest
    Register-ScheduledTask -TaskName $BackupTask -Action $action -Trigger $trigger -Settings $settings `
        -Principal $principal -Force | Out-Null
    & (Join-Path $AppDir 'setup\backup.ps1') -AppDir $AppDir

    # ---------- what the desktop icon opens, and the login sheet
    $urls = @("http://localhost:$appPort") + (Get-LanIPs | ForEach-Object { "http://${_}:$appPort" })
    [IO.File]::WriteAllText($UrlFile, "http://localhost:$appPort")
    if ($isNew) {
        $sheet = @"
Infresco SMS - first login
===========================
Open: double-click "Infresco SMS" on the desktop
      (or $($urls[0]) in a browser on this PC)
Phones on the same Wi-Fi: $(($urls | Select-Object -Skip 1) -join '   ')

Principal: username  principal   password  $initialPw   PIN  $initialPin
Clerk:     username  clerk       password  $initialPw   PIN  $initialPin

Change these after the first login: Users & roles -> Edit -> Reset.
Keep this sheet safe, then delete it.
Data and backups: $DataDir
"@
        [IO.File]::WriteAllText($SheetFile, $sheet)
    }
    Write-Step 'Setup finished'
    exit 0
} catch {
    Write-Host "SETUP FAILED: $($_.Exception.Message)"
    Write-Host $_.ScriptStackTrace
    exit 1
} finally {
    Stop-Transcript | Out-Null
}
