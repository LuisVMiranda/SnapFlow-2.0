@echo off
setlocal EnableExtensions
chcp 65001 >nul
title APP FOTOGRAFIA - INICIAR TUDO
cd /d "%~dp0"
call "%~dp0PREPARAR_DEPENDENCIAS_LOCAIS.bat" tudo
if errorlevel 1 exit /b 1

if exist "%~dp0.env" (
  for /f "usebackq tokens=1,* delims==" %%A in ("%~dp0.env") do (
    if /i "%%A"=="SNAPFLOW_DEV_HOST" set "SNAPFLOW_DEV_HOST=%%B"
    if /i "%%A"=="SNAPFLOW_DEV_PORT" set "SNAPFLOW_DEV_PORT=%%B"
    if /i "%%A"=="SNAPFLOW_ALLOWED_HOSTS" set "SNAPFLOW_ALLOWED_HOSTS=%%B"
  )
)
if "%SNAPFLOW_DEV_HOST%"=="" set "SNAPFLOW_DEV_HOST=127.0.0.1"
if "%SNAPFLOW_DEV_PORT%"=="" set "SNAPFLOW_DEV_PORT=5173"
echo Iniciando servidor e painel...
start "APP FOTOGRAFIA - SERVIDOR" cmd /k "cd /d ""%~dp0backend"" && cmd /c npm.cmd start"
timeout /t 2 /nobreak >nul
start "APP FOTOGRAFIA - PAINEL" cmd /k "cd /d ""%~dp0"" && set SNAPFLOW_DEV_HOST=%SNAPFLOW_DEV_HOST%&& set SNAPFLOW_DEV_PORT=%SNAPFLOW_DEV_PORT%&& set SNAPFLOW_ALLOWED_HOSTS=%SNAPFLOW_ALLOWED_HOSTS%&& npm.cmd run dev -- --host %SNAPFLOW_DEV_HOST% --port %SNAPFLOW_DEV_PORT%"
endlocal
