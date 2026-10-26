# Called by the uninstaller: removes services, firewall rule and backup task.
# The school's data (database, backups) in C:\ProgramData\InfrescoSMS is KEPT.
param([string]$AppDir = (Split-Path -Parent $PSScriptRoot))
$ErrorActionPreference = 'Continue'
. (Join-Path $PSScriptRoot 'common.ps1')

if (Get-Service $AppService -ErrorAction SilentlyContinue) {
    Stop-Service $AppService -Force -ErrorAction SilentlyContinue
    & (Join-Path $AppDir 'service\InfrescoSMS-App.exe') uninstall | Out-Null
}
if (Get-Service $DbService -ErrorAction SilentlyContinue) {
    Stop-Service $DbService -Force -ErrorAction SilentlyContinue
    & (Join-Path $AppDir 'pgsql\bin\pg_ctl.exe') unregister -N $DbService | Out-Null
}
Get-NetFirewallRule -Name 'InfrescoSMS' -ErrorAction SilentlyContinue | Remove-NetFirewallRule
Unregister-ScheduledTask -TaskName $BackupTask -Confirm:$false -ErrorAction SilentlyContinue
Write-Host "Removed services. Data kept in $DataDir"
