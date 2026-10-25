@echo off
rem Double-click to back up the database into the backups folder (see backup.ps1).
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0backup.ps1" %*
pause
