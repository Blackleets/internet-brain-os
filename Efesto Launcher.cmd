@echo off
setlocal
cd /d "%~dp0"
echo Starting Efesto Launcher...
echo.
pnpm efesto:launcher repair
set EXIT_CODE=%ERRORLEVEL%
echo.
if "%EXIT_CODE%"=="0" (
  echo Efesto is ready. Open the browser extension and press the central orb.
) else (
  echo Efesto needs attention. Review the diagnostics above or run: pnpm efesto:launcher status
)
echo.
pause
exit /b %EXIT_CODE%
