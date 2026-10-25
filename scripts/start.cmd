@echo off
rem Double-click to start the school office app (see start.ps1).
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0start.ps1" %*
pause
