@echo off
chcp 65001 >nul
title MODUL-AI
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo No se encontro Node.js. Usa MODUL-AI.exe o instala Node 22.13+ desde https://nodejs.org
  pause
  exit /b 1
)
node --no-warnings=ExperimentalWarning server\server.mjs --open
pause
