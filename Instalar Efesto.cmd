@echo off
setlocal
chcp 65001 >nul
cd /d "%~dp0"
echo Instalando Efesto. No cierres esta ventana.
echo.
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\windows\install-efesto-windows.ps1" %*
set EXIT_CODE=%ERRORLEVEL%
echo.
pause
exit /b %EXIT_CODE%
