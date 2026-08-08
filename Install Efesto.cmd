@echo off
setlocal
cd /d "%~dp0"
echo Installing or repairing Efesto...
echo.
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\install-efesto.ps1"
set EXIT_CODE=%ERRORLEVEL%
echo.
if "%EXIT_CODE%"=="0" (
  echo Efesto installation completed successfully.
) else (
  echo Efesto installation needs attention. Review the diagnostics above.
)
echo.
pause
exit /b %EXIT_CODE%
