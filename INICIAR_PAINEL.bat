@echo off
setlocal EnableExtensions
chcp 65001 >nul
title APP FOTOGRAFIA - PAINEL
cd /d "%~dp0"
call "%~dp0PREPARAR_DEPENDENCIAS_LOCAIS.bat" painel
if errorlevel 1 (
  echo.
  echo Não foi possível preparar o painel do SnapFlow.
  echo Leia a mensagem acima, corrija o item indicado e rode este arquivo novamente.
  pause
  exit /b 1
)

if exist "%~dp0.env" (
  for /f "usebackq tokens=1,* delims==" %%A in ("%~dp0.env") do (
    if /i "%%A"=="SNAPFLOW_DEV_HOST" set "SNAPFLOW_DEV_HOST=%%B"
    if /i "%%A"=="SNAPFLOW_DEV_PORT" set "SNAPFLOW_DEV_PORT=%%B"
    if /i "%%A"=="SNAPFLOW_ALLOWED_HOSTS" set "SNAPFLOW_ALLOWED_HOSTS=%%B"
  )
)
if "%SNAPFLOW_DEV_HOST%"=="" set "SNAPFLOW_DEV_HOST=127.0.0.1"
if "%SNAPFLOW_DEV_PORT%"=="" set "SNAPFLOW_DEV_PORT=5173"
echo Iniciando painel local em %SNAPFLOW_DEV_HOST%:%SNAPFLOW_DEV_PORT%...
cmd /c npm.cmd run dev -- --host %SNAPFLOW_DEV_HOST% --port %SNAPFLOW_DEV_PORT%
endlocal
