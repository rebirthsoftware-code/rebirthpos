@echo off
cd /d "%~dp0"
start "" http://localhost:4100
node --no-warnings server.js
pause
