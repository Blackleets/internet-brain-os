@echo off
setlocal
chcp 65001 >nul
cd /d "%~dp0"
echo Deteniendo Efesto...
node "%~dp0scripts\windows\efesto-windows-stack.mjs" stop
set EXIT_CODE=%ERRORLEVEL%
echo.
pause
exit /b %EXIT_CODE%
