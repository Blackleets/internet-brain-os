@echo off
setlocal
cd /d "%~dp0"
echo This setup installs Efesto and enables automatic startup for your Windows account.
echo You can undo it with Disable Efesto Auto Start.cmd.
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\install-efesto.ps1" -EnableAutoStart
set EXIT_CODE=%ERRORLEVEL%
if not "%EXIT_CODE%"=="0" goto FINISH
start "" "https://efesto-five.vercel.app/"
echo Pair the Efesto extension once and enable its automatic web reconnection option.
:FINISH
pause
exit /b %EXIT_CODE%
