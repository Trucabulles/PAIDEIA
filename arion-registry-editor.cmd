@echo off
setlocal
cd /d "%~dp0"
node tools\arion-registry-editor\server.mjs
endlocal
