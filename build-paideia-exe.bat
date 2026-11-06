@echo off
setlocal
cd /d "%~dp0"
powershell.exe -NoProfile -ExecutionPolicy Bypass -File ".\scripts\run-tauri-fixed-webview.ps1" build --bundles nsis %*
if errorlevel 1 exit /b %ERRORLEVEL%
powershell.exe -NoProfile -ExecutionPolicy Bypass -File ".\scripts\build-paideia-portable.ps1" -SkipBuild
exit /b %ERRORLEVEL%
