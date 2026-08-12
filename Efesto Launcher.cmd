@echo off
setlocal
cd /d "%~dp0"
echo Starting Efesto Launcher...
echo.

where node >nul 2>&1
if errorlevel 1 goto INSTALL_OR_REPAIR
where pnpm >nul 2>&1
if errorlevel 1 goto INSTALL_OR_REPAIR
if not exist "%~dp0node_modules" goto INSTALL_OR_REPAIR
if not exist "%~dp0packages\shared\dist\index.js" goto INSTALL_OR_REPAIR
if not exist "%~dp0packages\kernel\dist\index.js" goto INSTALL_OR_REPAIR
if not exist "%~dp0packages\connectors\dist\index.js" goto INSTALL_OR_REPAIR

pnpm efesto:launcher repair
set EXIT_CODE=%ERRORLEVEL%
goto FINISH

:INSTALL_OR_REPAIR
echo Efesto prerequisites or runtime files are missing or incomplete. Running one-click repair...
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\install-efesto.ps1" -SkipShortcut
set EXIT_CODE=%ERRORLEVEL%

:FINISH
echo.
if "%EXIT_CODE%"=="0" (
  echo Efesto is ready. Open the browser extension and press the central orb.
) else (
  echo Efesto needs attention. Double-click "Install Efesto.cmd" to repair the installation.
)
echo.
pause
exit /b %EXIT_CODE%
