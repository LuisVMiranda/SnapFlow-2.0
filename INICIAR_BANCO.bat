@echo off
setlocal EnableExtensions
chcp 65001 >nul
title APP FOTOGRAFIA - BANCO
cd /d "%~dp0" || (
  echo ERRO: não foi possível entrar na pasta do SnapFlow.
  exit /b 1
)
set "ROOT=%CD%"
set "CHECK_ONLY=N"
set "SKIP_PREPARE=N"
set "SKIP_MIGRATIONS=N"

:ler_args
if "%~1"=="" goto args_lidos
if /i "%~1"=="--verificar" set "CHECK_ONLY=S"
if /i "%~1"=="--skip-prepare" set "SKIP_PREPARE=S"
if /i "%~1"=="--sem-migracoes" set "SKIP_MIGRATIONS=S"
shift
goto ler_args

:args_lidos
if /i "%CHECK_ONLY%"=="S" goto verificar
if /i not "%SKIP_PREPARE%"=="S" (
  call "%ROOT%\PREPARAR_DEPENDENCIAS_LOCAIS.bat" servidor
  if errorlevel 1 exit /b 1
)

call :carregar_root_env
if /i "%SNAPFLOW_DB_MODE%"=="native" goto banco_nativo
goto banco_docker

:verificar
echo Verificando scripts de banco sem iniciar serviços...
cmd /c node --check scripts\run-docker-compose.mjs
if errorlevel 1 exit /b 1
cmd /c node --check scripts\sync-docker-env.mjs
if errorlevel 1 exit /b 1
cmd /c node --check scripts\snapflow-startup.mjs
if errorlevel 1 exit /b 1
cmd /c node scripts\run-docker-compose.mjs version
if errorlevel 1 exit /b 1
echo Verificação do banco concluída.
exit /b 0

:banco_docker
cmd /c node scripts\sync-docker-env.mjs
if errorlevel 1 exit /b 1
call :carregar_root_env
call :postgres_tcp_pronto
if not errorlevel 1 goto banco_docker_pronto
call :garantir_docker_pronto || exit /b 1
echo Subindo PostgreSQL local pelo Docker...
cmd /c npm.cmd run db:up
if errorlevel 1 exit /b 1
call :aguardar_postgres_tcp || exit /b 1
:banco_docker_pronto
call :rodar_migracoes_se_preciso
exit /b %ERRORLEVEL%

:banco_nativo
echo Modo PostgreSQL nativo detectado.
call :garantir_postgres_nativo || exit /b 1
call :rodar_migracoes_se_preciso
exit /b %ERRORLEVEL%

:rodar_migracoes_se_preciso
if /i "%SKIP_MIGRATIONS%"=="S" exit /b 0
echo Rodando migrações do banco...
cmd /c npm.cmd run db:migrate
exit /b %ERRORLEVEL%

:carregar_root_env
if not exist "%ROOT%\.env" exit /b 0
for /f "usebackq tokens=1,* delims==" %%A in ("%ROOT%\.env") do (
  if /i "%%A"=="SNAPFLOW_DB_MODE" set "SNAPFLOW_DB_MODE=%%B"
  if /i "%%A"=="POSTGRES_DB" set "POSTGRES_DB=%%B"
  if /i "%%A"=="POSTGRES_USER" set "POSTGRES_USER=%%B"
  if /i "%%A"=="POSTGRES_PASSWORD" set "POSTGRES_PASSWORD=%%B"
  if /i "%%A"=="POSTGRES_PORT" set "POSTGRES_PORT=%%B"
)
exit /b 0

:garantir_docker_pronto
where docker >nul 2>nul
if errorlevel 1 (
  echo ERRO: Docker não foi encontrado. Rode INSTALAR_SNAPFLOW.bat ou use INSTALAR_SNAPFLOW_SEM_DOCKER.bat.
  exit /b 1
)
docker info >nul 2>nul
if not errorlevel 1 exit /b 0
echo Docker Desktop não está pronto. Tentando abrir e aguardar o engine...
if exist "%ProgramFiles%\Docker\Docker\Docker Desktop.exe" (
  start "" "%ProgramFiles%\Docker\Docker\Docker Desktop.exe"
)
for /l %%I in (1,1,60) do (
  docker info >nul 2>nul
  if not errorlevel 1 exit /b 0
  timeout /t 3 /nobreak >nul
)
echo ERRO: Docker Desktop não respondeu. Abra o Docker Desktop, aguarde ficar pronto e rode este BAT novamente.
exit /b 1

:aguardar_postgres_tcp
if "%POSTGRES_PORT%"=="" set "POSTGRES_PORT=55432"
echo Aguardando PostgreSQL ficar pronto...
for /l %%I in (1,1,40) do (
  call :postgres_tcp_pronto
  if not errorlevel 1 (
    echo PostgreSQL pronto.
    exit /b 0
  )
  timeout /t 2 /nobreak >nul
)
echo ERRO: PostgreSQL não ficou pronto dentro do tempo esperado.
exit /b 1

:postgres_tcp_pronto
if "%POSTGRES_PORT%"=="" set "POSTGRES_PORT=55432"
powershell -NoProfile -ExecutionPolicy Bypass -Command "$c=[Net.Sockets.TcpClient]::new(); try { $c.Connect('127.0.0.1',[int]$env:POSTGRES_PORT); exit 0 } catch { exit 1 } finally { $c.Dispose() }" >nul 2>nul
exit /b %ERRORLEVEL%

:garantir_postgres_nativo
call :detectar_servico_postgres
if defined POSTGRES_SERVICE (
  sc query "%POSTGRES_SERVICE%" | find /i "RUNNING" >nul 2>nul
  if not errorlevel 1 (
    echo Serviço PostgreSQL rodando: %POSTGRES_SERVICE%
    exit /b 0
  )
  echo Serviço PostgreSQL parado: %POSTGRES_SERVICE%
  net start "%POSTGRES_SERVICE%"
  if not errorlevel 1 exit /b 0
  echo ERRO: não foi possível iniciar o serviço PostgreSQL. Rode este BAT como administrador ou inicie o serviço manualmente.
  exit /b 1
)
echo ERRO: serviço PostgreSQL nativo não detectado. Use INSTALAR_SNAPFLOW_SEM_DOCKER.bat para configurar.
exit /b 1

:detectar_servico_postgres
set "POSTGRES_SERVICE="
for /f "usebackq delims=" %%A in (`powershell -NoProfile -ExecutionPolicy Bypass -Command "$svc=Get-Service -Name 'postgresql*' -ErrorAction SilentlyContinue | Sort-Object Name -Descending | Select-Object -First 1; if($svc){$svc.Name}"`) do set "POSTGRES_SERVICE=%%A"
exit /b 0
