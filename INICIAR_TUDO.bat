@echo off
setlocal
title APP FOTOGRAFIA - INICIAR TUDO
cd /d "%~dp0"
echo Iniciando servidor e painel...
start "APP FOTOGRAFIA - SERVIDOR" cmd /k "cd /d ""%~dp0backend"" && node server.js"
timeout /t 2 /nobreak >nul
start "APP FOTOGRAFIA - PAINEL" cmd /k "cd /d ""%~dp0"" && npm.cmd run dev -- --host 127.0.0.1 --port 5173"
endlocal
