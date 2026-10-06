@echo off
setlocal
cd /d "%~dp0"
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\efesto-autostart.ps1" -Action Disable
set EXIT_CODE=%ERRORLEVEL%
pause
exit /b %EXIT_CODE%
