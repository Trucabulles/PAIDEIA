@echo off
setlocal
cd /d "%~dp0"
node ".\scripts\update-paideia-version.mjs" %*
if errorlevel 1 (
  echo.
  echo La mise a jour de version a echoue.
  pause
  exit /b 1
)
echo.
echo Mise a jour terminee.
pause
