@echo off
setlocal EnableExtensions
chcp 65001 >nul
title APP FOTOGRAFIA - SERVIDOR
cd /d "%~dp0"
call "%~dp0PREPARAR_DEPENDENCIAS_LOCAIS.bat" servidor
if errorlevel 1 (
  echo.
  echo Não foi possível preparar o servidor do SnapFlow.
  echo Leia a mensagem acima, corrija o item indicado e rode este arquivo novamente.
  pause
  exit /b 1
)

set "SNAPFLOW_API_PORT="
if exist "%~dp0backend\.env.local" (
  for /f "usebackq tokens=1,* delims==" %%A in ("%~dp0backend\.env.local") do (
    if /i "%%A"=="PORT" set "SNAPFLOW_API_PORT=%%B"
  )
)
if "%SNAPFLOW_API_PORT%"=="" set "SNAPFLOW_API_PORT=3000"
cmd /c node scripts\snapflow-startup.mjs assert-port API "%SNAPFLOW_API_PORT%"
if errorlevel 1 (
  echo Feche a janela APP FOTOGRAFIA - SERVIDOR antiga e tente novamente.
  pause
  exit /b 1
)

call "%~dp0INICIAR_BANCO.bat" --skip-prepare
if errorlevel 1 (
  echo.
  echo Não foi possível iniciar o banco de dados ou aplicar as migrações.
  echo Corrija a mensagem acima e rode este arquivo novamente.
  pause
  exit /b 1
)

cd /d "%~dp0backend"
set "SNAPFLOW_SKIP_STARTUP_MIGRATIONS=1"
echo Iniciando servidor na porta %SNAPFLOW_API_PORT%...
cmd /c npm.cmd start
set "EXIT_CODE=%ERRORLEVEL%"
endlocal & exit /b %EXIT_CODE%
