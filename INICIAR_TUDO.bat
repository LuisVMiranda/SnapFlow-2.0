@echo off
setlocal EnableExtensions
chcp 65001 >nul
title APP FOTOGRAFIA - INICIAR TUDO
cd /d "%~dp0"
call "%~dp0PREPARAR_DEPENDENCIAS_LOCAIS.bat" tudo
if errorlevel 1 (
  echo.
  echo Não foi possível preparar o SnapFlow para iniciar.
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
  echo Ajuste PORT em backend\.env.local ou SNAPFLOW_DEV_PORT no arquivo .env.
  pause
  exit /b 1
)
cmd /c node scripts\snapflow-startup.mjs assert-port API "%SNAPFLOW_API_PORT%"
if errorlevel 1 (
  echo Feche a janela APP FOTOGRAFIA - SERVIDOR antiga e rode este arquivo novamente.
  pause
  exit /b 1
)
cmd /c node scripts\snapflow-startup.mjs assert-port painel "%SNAPFLOW_DEV_PORT%"
if errorlevel 1 (
  echo Feche a janela APP FOTOGRAFIA - PAINEL ou o aplicativo que ocupa a porta e tente novamente.
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
echo Iniciando servidor e painel...
start "APP FOTOGRAFIA - SERVIDOR" cmd /k "set SNAPFLOW_SKIP_STARTUP_MIGRATIONS=1&& cd /d ""%~dp0backend"" && cmd /c npm.cmd start"
echo Aguardando a API confirmar que está pronta...
cmd /c node scripts\snapflow-startup.mjs wait-api "http://127.0.0.1:%SNAPFLOW_API_PORT%/api/health" 90 1000
if errorlevel 1 (
  echo.
  echo O servidor não ficou pronto. Confira a janela APP FOTOGRAFIA - SERVIDOR e corrija o erro exibido.
  pause
  exit /b 1
)
start "APP FOTOGRAFIA - PAINEL" cmd /k "cd /d ""%~dp0"" && set SNAPFLOW_DEV_HOST=%SNAPFLOW_DEV_HOST%&& set SNAPFLOW_DEV_PORT=%SNAPFLOW_DEV_PORT%&& set SNAPFLOW_API_PORT=%SNAPFLOW_API_PORT%&& set SNAPFLOW_ALLOWED_HOSTS=%SNAPFLOW_ALLOWED_HOSTS%&& npm.cmd run dev -- --host %SNAPFLOW_DEV_HOST% --port %SNAPFLOW_DEV_PORT% --strictPort"
echo Aguardando o painel confirmar que está pronto...
cmd /c node scripts\snapflow-startup.mjs wait-panel "http://127.0.0.1:%SNAPFLOW_DEV_PORT%/" 30 1000
if errorlevel 1 (
  echo.
  echo O painel não ficou pronto. Confira a janela APP FOTOGRAFIA - PAINEL e a porta %SNAPFLOW_DEV_PORT%.
  pause
  exit /b 1
)
echo SnapFlow iniciado com banco, API e painel confirmados.
endlocal
