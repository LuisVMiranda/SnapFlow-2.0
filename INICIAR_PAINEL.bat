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
    if /i "%%A"=="SNAPFLOW_API_PORT" set "SNAPFLOW_API_PORT=%%B"
    if /i "%%A"=="SNAPFLOW_ALLOWED_HOSTS" set "SNAPFLOW_ALLOWED_HOSTS=%%B"
  )
)
set "BACKEND_API_PORT="
if exist "%~dp0backend\.env.local" (
  for /f "usebackq tokens=1,* delims==" %%A in ("%~dp0backend\.env.local") do (
    if /i "%%A"=="PORT" set "BACKEND_API_PORT=%%B"
  )
)
if not "%BACKEND_API_PORT%"=="" set "SNAPFLOW_API_PORT=%BACKEND_API_PORT%"
if "%SNAPFLOW_DEV_HOST%"=="" set "SNAPFLOW_DEV_HOST=127.0.0.1"
if "%SNAPFLOW_DEV_PORT%"=="" set "SNAPFLOW_DEV_PORT=5173"
if "%SNAPFLOW_API_PORT%"=="" set "SNAPFLOW_API_PORT=3000"
if "%SNAPFLOW_API_PORT%"=="%SNAPFLOW_DEV_PORT%" (
  echo ERRO: API e painel não podem usar a mesma porta %SNAPFLOW_API_PORT%.
  pause
  exit /b 1
)
echo Confirmando a API na porta %SNAPFLOW_API_PORT%...
cmd /c node scripts\snapflow-startup.mjs wait-api "http://127.0.0.1:%SNAPFLOW_API_PORT%/api/health" 30 1000
if errorlevel 1 (
  echo Inicie primeiro o servidor com INICIAR_SERVIDOR.bat ou use INICIAR_TUDO.bat.
  pause
  exit /b 1
)
cmd /c node scripts\snapflow-startup.mjs assert-port painel "%SNAPFLOW_DEV_PORT%"
if errorlevel 1 (
  echo Feche a janela APP FOTOGRAFIA - PAINEL antiga e tente novamente.
  pause
  exit /b 1
)
echo Iniciando painel local em %SNAPFLOW_DEV_HOST%:%SNAPFLOW_DEV_PORT%...
cmd /c npm.cmd run dev -- --host %SNAPFLOW_DEV_HOST% --port %SNAPFLOW_DEV_PORT% --strictPort
set "EXIT_CODE=%ERRORLEVEL%"
endlocal & exit /b %EXIT_CODE%
