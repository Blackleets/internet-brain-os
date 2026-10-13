@echo off
setlocal
chcp 65001 >nul
cd /d "%~dp0"
echo Iniciando Efesto...
where node >nul 2>&1
if errorlevel 1 goto INSTALL
if not exist "%~dp0node_modules" goto INSTALL
if not exist "%~dp0apps\dashboard\.next\BUILD_ID" goto INSTALL
node "%~dp0scripts\windows\efesto-windows-stack.mjs" start
set EXIT_CODE=%ERRORLEVEL%
if "%EXIT_CODE%"=="0" (
  node "%~dp0scripts\windows\efesto-windows-stack.mjs" copy-token
  start "" "http://127.0.0.1:3311"
)
goto FINISH
:INSTALL
echo Falta parte de la instalacion. Ejecutando "Instalar Efesto"...
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\windows\install-efesto-windows.ps1" -SkipShortcuts
set EXIT_CODE=%ERRORLEVEL%
:FINISH
echo.
if not "%EXIT_CODE%"=="0" echo Efesto necesita atencion. Revisa los mensajes de arriba.
pause
exit /b %EXIT_CODE%
