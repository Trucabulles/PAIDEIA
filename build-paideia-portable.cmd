@echo off
setlocal
cd /d "%~dp0"

echo ========================================
echo   Construction de PAIDEIA portable
echo ========================================
echo.

powershell.exe -NoProfile -ExecutionPolicy Bypass -File ".\scripts\build-paideia-portable.ps1" %*
set "BUILD_EXIT_CODE=%ERRORLEVEL%"

echo.
if not "%BUILD_EXIT_CODE%"=="0" (
  echo Le build portable a echoue.
  echo Code d'erreur : %BUILD_EXIT_CODE%
) else (
  echo Le build portable est termine.
  echo Archive disponible dans : artifacts\portable
)

echo.
pause
exit /b %BUILD_EXIT_CODE%
