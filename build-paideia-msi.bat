@echo off
setlocal
cd /d "%~dp0"
powershell.exe -NoProfile -ExecutionPolicy Bypass -File ".\scripts\run-tauri-fixed-webview.ps1" build --bundles msi %*
exit /b %ERRORLEVEL%
