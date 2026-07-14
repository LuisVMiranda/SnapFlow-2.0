@echo off
setlocal EnableExtensions
chcp 65001 >nul
cd /d "%~dp0." || (
  echo Não foi possível entrar na pasta do SnapFlow.
  exit /b 1
)
set "ROOT=%CD%"
set "POSTGRES_BIN="
set "PSQL_EXE="
set "PG_ISREADY_EXE="
set "POSTGRES_SERVICE="
if /i "%~1"=="--ajuda" goto ajuda
if /i "%~1"=="--verificar" goto modo_verificar
call :cabecalho
echo Este instalador prepara o SnapFlow sem Docker.
echo Ele instala/configura PostgreSQL nativo como serviço do Windows, cria arquivos locais,
echo instala pacotes npm, roda migrações e pode iniciar o painel.
echo.
echo O instalador principal com Docker continua sendo o método recomendado.
echo Use este arquivo quando Docker Desktop não for uma opção neste computador.
echo.
echo Nenhum segredo gerado aqui deve ser enviado ao Git. Os arquivos .env locais já são ignorados.
echo.
call :perguntar_sn CONTINUAR "Continuar com a instalação alternativa sem Docker" "S"
if /i not "%CONTINUAR%"=="S" (
  echo Instalação cancelada pelo usuário.
  exit /b 0
)
call :checar_powershell || goto falha
call :preparar_dependencias_base || goto falha
call :coletar_configuracao || goto falha
call :preparar_postgres_nativo || goto falha
call :configurar_banco_snapflow || goto falha
call :escrever_configuracao || goto falha
call :instalar_dependencias_npm || goto falha
call :rodar_migracoes || goto falha
call :testes_opcionais || goto falha
call :iniciar_opcional || goto falha
echo.
echo Instalação sem Docker concluída.
echo Painel local: %PUBLIC_BASE_URL%
echo API local: http://%HOST%:%PORT%
echo Banco PostgreSQL nativo: 127.0.0.1:%POSTGRES_PORT%/%POSTGRES_DB%
echo Token administrativo configurado: %ADMIN_ACCESS_TOKEN%
echo.
echo Guarde esse token. Ele será usado no botão Conta do painel.
exit /b 0
:ajuda
call :cabecalho
echo Uso:
echo   INSTALAR_SNAPFLOW_SEM_DOCKER.bat
echo   INSTALAR_SNAPFLOW_SEM_DOCKER.bat --verificar
echo   INSTALAR_SNAPFLOW_SEM_DOCKER.bat --ajuda
echo.
echo O modo normal instala e configura de forma interativa sem Docker.
echo O modo --verificar apenas confere comandos e ambiente sem alterar arquivos.
echo.
echo Observação: se PostgreSQL nativo precisar ser instalado, execute este arquivo como administrador.
exit /b 0
:modo_verificar
call :cabecalho
echo Modo de verificação sem Docker. Nenhum arquivo será criado ou alterado.
echo.
call :mostrar_comando "Git" "git --version"
call :mostrar_comando "Node.js" "node --version"
call :mostrar_comando "npm" "cmd /c npm.cmd --version"
echo.
call :localizar_postgres
if defined PSQL_EXE (
  echo PostgreSQL psql: %PSQL_EXE%
) else (
  echo PostgreSQL psql: ausente.
)
if defined PG_ISREADY_EXE (
  echo PostgreSQL pg_isready: %PG_ISREADY_EXE%
) else (
  echo PostgreSQL pg_isready: ausente.
)
call :detectar_servico_postgres
if defined POSTGRES_SERVICE (
  echo Serviço PostgreSQL: %POSTGRES_SERVICE%
) else (
  echo Serviço PostgreSQL: não detectado.
)
echo.
echo Scripts npm disponíveis na raiz:
cmd /c npm.cmd run
echo.
echo Scripts npm disponíveis no backend:
cmd /c npm.cmd --prefix backend run
echo.
echo Dependências locais do projeto:
call :verificar_dependencias_projeto
echo.
echo Verificação sem Docker concluída.
exit /b 0
:cabecalho
echo.
echo ============================================================
echo          INSTALADOR SNAPFLOW 2.0 - SEM DOCKER
echo ============================================================
echo.
exit /b 0
:checar_powershell
where powershell >nul 2>nul
if errorlevel 1 (
  echo ERRO: PowerShell não foi encontrado. O instalador precisa dele para gerar segredos e gravar arquivos.
  exit /b 1
)
exit /b 0
:preparar_dependencias_base
echo.
echo [1/8] Verificando dependências do Windows...
where winget >nul 2>nul
if errorlevel 1 (
  set "WINGET_OK=N"
  echo winget não foi encontrado. Dependências ausentes precisarão ser instaladas manualmente.
) else (
  set "WINGET_OK=S"
  for /f "delims=" %%A in ('winget --version 2^>nul') do echo winget encontrado: %%A
)
call :perguntar_sn AUTO_INSTALL "Instalar automaticamente dependências ausentes via winget" "S"
call :garantir_git || exit /b 1
call :garantir_node || exit /b 1
exit /b 0
:garantir_git
where git >nul 2>nul
if not errorlevel 1 (
  for /f "delims=" %%A in ('git --version 2^>nul') do echo Git encontrado: %%A
  exit /b 0
)
echo Git não foi encontrado.
if /i "%AUTO_INSTALL%"=="S" if /i "%WINGET_OK%"=="S" (
  call :instalar_winget "Git" "Git.Git"
  set "PATH=%PATH%;%ProgramFiles%\Git\cmd"
)
where git >nul 2>nul
if errorlevel 1 (
  echo AVISO: Git ainda não foi encontrado. Se você baixou o projeto como ZIP, pode continuar sem Git.
  exit /b 0
)
for /f "delims=" %%A in ('git --version 2^>nul') do echo Git instalado: %%A
exit /b 0
:garantir_node
where node >nul 2>nul
if not errorlevel 1 (
  node -e "const v=process.versions.node.split('.').map(Number); const ok=(v[0]===20&&v[1]>=19)||(v[0]===22&&v[1]>=13)||v[0]>=24; process.exit(ok?0:1)" >nul 2>nul
  if not errorlevel 1 (
    for /f "delims=" %%A in ('node --version 2^>nul') do echo Node.js compatível encontrado: %%A
    where npm.cmd >nul 2>nul
    if not errorlevel 1 exit /b 0
  )
)
echo Node.js compatível não foi encontrado. É necessário Node.js 20.19+, 22.13+ ou 24+.
if /i "%AUTO_INSTALL%"=="S" if /i "%WINGET_OK%"=="S" (
  call :instalar_winget "Node.js LTS" "OpenJS.NodeJS.LTS"
  set "PATH=%PATH%;%ProgramFiles%\nodejs;%AppData%\npm"
)
where node >nul 2>nul
if errorlevel 1 exit /b 1
node -e "const v=process.versions.node.split('.').map(Number); const ok=(v[0]===20&&v[1]>=19)||(v[0]===22&&v[1]>=13)||v[0]>=24; process.exit(ok?0:1)" >nul 2>nul
if errorlevel 1 (
  for /f "delims=" %%A in ('node --version 2^>nul') do echo Node.js encontrado, mas incompatível: %%A
  exit /b 1
)
where npm.cmd >nul 2>nul
if errorlevel 1 (
  echo npm.cmd não foi encontrado junto com o Node.js.
  exit /b 1
)
for /f "delims=" %%A in ('node --version 2^>nul') do echo Node.js pronto: %%A
exit /b 0
:coletar_configuracao
echo.
echo [2/8] Coletando configuração local...
echo Pressione ENTER para aceitar o valor padrão entre parênteses.
echo.
call :gerar_segredo DB_PASS_DEFAULT 24
call :gerar_segredo ADMIN_DEFAULT 32
call :gerar_segredo CREDENTIALS_DEFAULT 32
call :gerar_segredo WEBHOOK_DEFAULT 32
call :perguntar POSTGRES_DB "Nome do banco PostgreSQL, somente letras, números e underline" "snapflow"
call :perguntar POSTGRES_USER "Usuário do banco PostgreSQL, somente letras, números e underline" "snapflow"
call :perguntar POSTGRES_PASSWORD "Senha do usuário SnapFlow no PostgreSQL, use letras, números, - ou _" "%DB_PASS_DEFAULT%"
call :perguntar POSTGRES_PORT "Porta local do PostgreSQL nativo" "5432"
call :validar_identificador "Nome do banco PostgreSQL" "%POSTGRES_DB%" || exit /b 1
call :validar_identificador "Usuário do banco PostgreSQL" "%POSTGRES_USER%" || exit /b 1
call :validar_senha_banco || exit /b 1
call :validar_porta || exit /b 1
call :perguntar ADMIN_ACCESS_TOKEN "Token administrativo do painel" "%ADMIN_DEFAULT%"
call :perguntar ADMIN_LOCK_MINUTES "Bloqueio temporário administrativo em minutos, de 30 a 60" "30"
call :perguntar CREDENTIALS_SECRET "Segredo para criptografar credenciais" "%CREDENTIALS_DEFAULT%"
call :perguntar MP_ACCESS_TOKEN "Token Mercado Pago para Pix real" "APP_USR-your-mercado-pago-token"
call :perguntar MP_WEBHOOK_SECRET "Segredo do webhook Mercado Pago" "%WEBHOOK_DEFAULT%"
call :perguntar HOST "Host da API/backend" "127.0.0.1"
call :perguntar PORT "Porta da API/backend" "3000"
call :perguntar FRONTEND_HOST "Host do painel frontend" "127.0.0.1"
call :perguntar FRONTEND_PORT "Porta do painel frontend" "5173"
call :perguntar SNAPFLOW_ALLOWED_HOSTS "Hosts externos permitidos no painel, separados por vírgula" "nenhum"
if /i "%SNAPFLOW_ALLOWED_HOSTS%"=="nenhum" set "SNAPFLOW_ALLOWED_HOSTS="
set "PUBLIC_BASE_DEFAULT=http://localhost:%FRONTEND_PORT%"
call :perguntar PUBLIC_BASE_URL "URL pública/base do SnapFlow" "%PUBLIC_BASE_DEFAULT%"
call :perguntar STORAGE_ROOT "Diretório local de armazenamento das fotos" "./storage"
call :perguntar AUTO_CLEANUP_ENABLED "Ativar limpeza automática de retenção" "false"
exit /b 0
:preparar_postgres_nativo
echo.
echo [3/8] Preparando PostgreSQL nativo...
call :localizar_postgres
if defined PSQL_EXE if defined PG_ISREADY_EXE (
  echo PostgreSQL encontrado em: %POSTGRES_BIN%
  call :garantir_servico_postgres || exit /b 1
  exit /b 0
)
echo PostgreSQL nativo não foi encontrado.
if /i not "%AUTO_INSTALL%"=="S" (
  echo Instale PostgreSQL 16 manualmente ou rode novamente aceitando instalação via winget.
  exit /b 1
)
if /i not "%WINGET_OK%"=="S" (
  echo winget não está disponível para instalar PostgreSQL automaticamente.
  exit /b 1
)
call :garantir_admin "instalar PostgreSQL nativo" || exit /b 1
call :verificar_porta_livre_para_instalacao || exit /b 1
echo Instalando PostgreSQL 16 via winget. O Windows pode pedir confirmação de administrador.
winget install -e --id PostgreSQL.PostgreSQL.16 --source winget --accept-package-agreements --accept-source-agreements --override "--mode unattended --unattendedmodeui minimal --superpassword postgres --serverport %POSTGRES_PORT%"
if errorlevel 1 (
  echo A instalação pelo pacote PostgreSQL.PostgreSQL.16 falhou. Tentando pacote genérico PostgreSQL.PostgreSQL...
  winget install -e --id PostgreSQL.PostgreSQL --source winget --accept-package-agreements --accept-source-agreements --override "--mode unattended --unattendedmodeui minimal --superpassword postgres --serverport %POSTGRES_PORT%"
)
if errorlevel 1 (
  echo Não foi possível instalar PostgreSQL via winget.
  echo Instale PostgreSQL manualmente e rode este instalador novamente.
  exit /b 1
)
set "POSTGRES_SUPER_PASSWORD=postgres"
call :localizar_postgres
if not defined PSQL_EXE (
  echo PostgreSQL foi instalado, mas psql.exe não foi localizado.
  echo Abra um novo terminal ou adicione C:\Program Files\PostgreSQL\16\bin ao PATH.
  exit /b 1
)
if not defined PG_ISREADY_EXE (
  echo PostgreSQL foi instalado, mas pg_isready.exe não foi localizado.
  exit /b 1
)
echo PostgreSQL localizado em: %POSTGRES_BIN%
call :garantir_servico_postgres || exit /b 1
exit /b 0
:localizar_postgres
set "POSTGRES_BIN="
set "PSQL_EXE="
set "PG_ISREADY_EXE="
for /f "delims=" %%A in ('where psql 2^>nul') do (
  set "PSQL_EXE=%%A"
  for %%B in ("%%~dpA.") do set "POSTGRES_BIN=%%~fB"
  goto localizar_pg_isready_path
)
for /f "usebackq delims=" %%A in (`powershell -NoProfile -ExecutionPolicy Bypass -Command "$root=Join-Path $env:ProgramFiles 'PostgreSQL'; if(Test-Path $root){$found=Get-ChildItem $root -Directory | Sort-Object @{Expression={try{[int]$_.Name}catch{0}};Descending=$true} | ForEach-Object { $bin=Join-Path $_.FullName 'bin'; if((Test-Path (Join-Path $bin 'psql.exe')) -and (Test-Path (Join-Path $bin 'pg_isready.exe'))){$bin} } | Select-Object -First 1; if($found){$found}}"`) do set "POSTGRES_BIN=%%A"
if defined POSTGRES_BIN (
  set "PSQL_EXE=%POSTGRES_BIN%\psql.exe"
  set "PG_ISREADY_EXE=%POSTGRES_BIN%\pg_isready.exe"
  set "PATH=%POSTGRES_BIN%;%PATH%"
)
exit /b 0
:localizar_pg_isready_path
for /f "delims=" %%A in ('where pg_isready 2^>nul') do (
  set "PG_ISREADY_EXE=%%A"
  exit /b 0
)
if defined POSTGRES_BIN if exist "%POSTGRES_BIN%\pg_isready.exe" set "PG_ISREADY_EXE=%POSTGRES_BIN%\pg_isready.exe"
exit /b 0
:detectar_servico_postgres
set "POSTGRES_SERVICE="
for /f "usebackq delims=" %%A in (`powershell -NoProfile -ExecutionPolicy Bypass -Command "$svc=Get-Service -Name 'postgresql*' -ErrorAction SilentlyContinue | Sort-Object Name -Descending | Select-Object -First 1; if($svc){$svc.Name}"`) do set "POSTGRES_SERVICE=%%A"
exit /b 0
:garantir_servico_postgres
call :detectar_servico_postgres
if not defined POSTGRES_SERVICE (
  echo Serviço do PostgreSQL não foi detectado.
  echo Se você instalou PostgreSQL manualmente, confirme que o serviço foi criado e está rodando.
  exit /b 1
)
sc query "%POSTGRES_SERVICE%" | find /i "RUNNING" >nul 2>nul
if not errorlevel 1 (
  echo Serviço PostgreSQL rodando: %POSTGRES_SERVICE%
  call :aguardar_postgres_nativo
  exit /b %ERRORLEVEL%
)
echo Serviço PostgreSQL detectado, mas parado: %POSTGRES_SERVICE%
call :garantir_admin "iniciar o serviço PostgreSQL" || exit /b 1
net start "%POSTGRES_SERVICE%"
if errorlevel 1 (
  echo Não foi possível iniciar o serviço PostgreSQL.
  exit /b 1
)
call :aguardar_postgres_nativo
exit /b %ERRORLEVEL%
:aguardar_postgres_nativo
echo Aguardando PostgreSQL responder em 127.0.0.1:%POSTGRES_PORT%...
for /l %%I in (1,1,40) do (
  "%PG_ISREADY_EXE%" -h 127.0.0.1 -p "%POSTGRES_PORT%" -d postgres >nul 2>nul
  if not errorlevel 1 (
    echo PostgreSQL nativo pronto.
    exit /b 0
  )
  timeout /t 2 /nobreak >nul
)
echo PostgreSQL não respondeu na porta %POSTGRES_PORT%.
echo Se ele foi instalado em outra porta, rode este instalador novamente e informe a porta correta.
exit /b 1
:verificar_porta_livre_para_instalacao
netstat -ano | findstr /r /c:":%POSTGRES_PORT% .*LISTENING" >nul 2>nul
if errorlevel 1 exit /b 0
echo A porta %POSTGRES_PORT% já está ocupada.
echo O instalador não altera serviços existentes automaticamente.
call :perguntar POSTGRES_PORT "Informe outra porta para o PostgreSQL nativo" "5433"
call :validar_porta || exit /b 1
netstat -ano | findstr /r /c:":%POSTGRES_PORT% .*LISTENING" >nul 2>nul
if not errorlevel 1 (
  echo A porta %POSTGRES_PORT% também está ocupada.
  exit /b 1
)
exit /b 0
:configurar_banco_snapflow
echo.
echo [4/8] Criando usuário e banco do SnapFlow...
if not defined POSTGRES_SUPER_PASSWORD set "POSTGRES_SUPER_PASSWORD=postgres"
call :testar_superusuario
if errorlevel 1 (
  echo A senha padrão do usuário postgres não funcionou.
  call :perguntar_secreto POSTGRES_SUPER_PASSWORD "Digite a senha do usuário postgres"
  call :testar_superusuario
  if errorlevel 1 (
    echo Não foi possível conectar como postgres.
    echo Abra o pgAdmin ou o instalador do PostgreSQL, confirme/redefina a senha do usuário postgres e rode novamente.
    exit /b 1
  )
)
set "PGPASSWORD=%POSTGRES_SUPER_PASSWORD%"
set "ROLE_EXISTS="
for /f "usebackq delims=" %%A in (`"%PSQL_EXE%" -h 127.0.0.1 -p "%POSTGRES_PORT%" -U postgres -d postgres -tAc "select 1 from pg_roles where rolname='%POSTGRES_USER%'" 2^>nul`) do set "ROLE_EXISTS=%%A"
if "%ROLE_EXISTS%"=="1" (
  "%PSQL_EXE%" -h 127.0.0.1 -p "%POSTGRES_PORT%" -U postgres -d postgres -v ON_ERROR_STOP=1 -c "ALTER ROLE %POSTGRES_USER% WITH LOGIN PASSWORD '%POSTGRES_PASSWORD%';"
) else (
  "%PSQL_EXE%" -h 127.0.0.1 -p "%POSTGRES_PORT%" -U postgres -d postgres -v ON_ERROR_STOP=1 -c "CREATE ROLE %POSTGRES_USER% WITH LOGIN PASSWORD '%POSTGRES_PASSWORD%';"
)
if errorlevel 1 exit /b 1
set "DB_EXISTS="
for /f "usebackq delims=" %%A in (`"%PSQL_EXE%" -h 127.0.0.1 -p "%POSTGRES_PORT%" -U postgres -d postgres -tAc "select 1 from pg_database where datname='%POSTGRES_DB%'" 2^>nul`) do set "DB_EXISTS=%%A"
if not "%DB_EXISTS%"=="1" (
  "%PSQL_EXE%" -h 127.0.0.1 -p "%POSTGRES_PORT%" -U postgres -d postgres -v ON_ERROR_STOP=1 -c "CREATE DATABASE %POSTGRES_DB% OWNER %POSTGRES_USER%;"
  if errorlevel 1 exit /b 1
)
"%PSQL_EXE%" -h 127.0.0.1 -p "%POSTGRES_PORT%" -U postgres -d postgres -v ON_ERROR_STOP=1 -c "ALTER DATABASE %POSTGRES_DB% OWNER TO %POSTGRES_USER%;" >nul
if errorlevel 1 exit /b 1
set "PGPASSWORD=%POSTGRES_PASSWORD%"
"%PSQL_EXE%" -h 127.0.0.1 -p "%POSTGRES_PORT%" -U "%POSTGRES_USER%" -d "%POSTGRES_DB%" -c "select 1;" >nul
if errorlevel 1 (
  echo O usuário %POSTGRES_USER% foi criado, mas não conseguiu conectar ao banco %POSTGRES_DB%.
  exit /b 1
)
echo Banco %POSTGRES_DB% pronto para o SnapFlow.
exit /b 0
:testar_superusuario
set "PGPASSWORD=%POSTGRES_SUPER_PASSWORD%"
"%PSQL_EXE%" -h 127.0.0.1 -p "%POSTGRES_PORT%" -U postgres -d postgres -c "select 1;" >nul 2>nul
exit /b %ERRORLEVEL%
:escrever_configuracao
echo.
echo [5/8] Criando arquivos locais de configuração...
call :timestamp
if exist "%ROOT%\.env" (
  call :perguntar_sn SOBRESCREVER_ROOT_ENV "O arquivo .env da raiz já existe. Substituir após backup" "N"
) else (
  set "SOBRESCREVER_ROOT_ENV=S"
)
if exist "%ROOT%\backend\.env.local" (
  call :perguntar_sn SOBRESCREVER_BACKEND_ENV "O arquivo backend\.env.local já existe. Substituir após backup para usar PostgreSQL sem Docker" "S"
) else (
  set "SOBRESCREVER_BACKEND_ENV=S"
)
if /i "%SOBRESCREVER_ROOT_ENV%"=="S" (
  if exist "%ROOT%\.env" copy /Y "%ROOT%\.env" "%ROOT%\.env.bak-%STAMP%" >nul
  set "SNAPFLOW_ROOT=%ROOT%"
  powershell -NoProfile -ExecutionPolicy Bypass -Command "$root=$env:SNAPFLOW_ROOT; $lines=@('SNAPFLOW_DB_MODE=native','SNAPFLOW_API_PORT='+$env:PORT,'SNAPFLOW_DEV_HOST='+$env:FRONTEND_HOST,'SNAPFLOW_DEV_PORT='+$env:FRONTEND_PORT,'SNAPFLOW_ALLOWED_HOSTS='+$env:SNAPFLOW_ALLOWED_HOSTS); [IO.File]::WriteAllLines((Join-Path $root '.env'), $lines, [Text.UTF8Encoding]::new($false))"
  if errorlevel 1 exit /b 1
  echo Criado: .env
) else (
  echo Mantido: .env existente
)
if /i "%SOBRESCREVER_BACKEND_ENV%"=="S" (
  if exist "%ROOT%\backend\.env.local" copy /Y "%ROOT%\backend\.env.local" "%ROOT%\backend\.env.local.bak-%STAMP%" >nul
  set "SNAPFLOW_ROOT=%ROOT%"
  powershell -NoProfile -ExecutionPolicy Bypass -Command "$root=$env:SNAPFLOW_ROOT; $db='postgres://'+$env:POSTGRES_USER+':'+$env:POSTGRES_PASSWORD+'@127.0.0.1:'+$env:POSTGRES_PORT+'/'+$env:POSTGRES_DB; $lines=@('DATABASE_URL='+$db,'ADMIN_ACCESS_TOKEN='+$env:ADMIN_ACCESS_TOKEN,'ADMIN_LOCK_MINUTES='+$env:ADMIN_LOCK_MINUTES,'CREDENTIALS_SECRET='+$env:CREDENTIALS_SECRET,'MP_ACCESS_TOKEN='+$env:MP_ACCESS_TOKEN,'MP_WEBHOOK_SECRET='+$env:MP_WEBHOOK_SECRET,'PUBLIC_BASE_URL='+$env:PUBLIC_BASE_URL,'HOST='+$env:HOST,'PORT='+$env:PORT,'STORAGE_ROOT='+$env:STORAGE_ROOT,'MAX_UPLOAD_MB=25','MAX_FILES_PER_UPLOAD=100','DEFAULT_GALLERY_RETENTION_DAYS=30','DELIVERED_PHOTO_RETENTION_DAYS=30','EXPIRED_SHARE_RETENTION_DAYS=7','AUTO_CLEANUP_ENABLED='+$env:AUTO_CLEANUP_ENABLED); [IO.File]::WriteAllLines((Join-Path $root 'backend\.env.local'), $lines, [Text.UTF8Encoding]::new($false))"
  if errorlevel 1 exit /b 1
  echo Criado: backend\.env.local
) else (
  echo Mantido: backend\.env.local existente
)
exit /b 0
:instalar_dependencias_npm
echo.
echo [6/8] Instalando dependências npm...
call :perguntar_sn INSTALAR_NPM "Rodar npm install na raiz e no backend" "S"
if /i not "%INSTALAR_NPM%"=="S" (
  call :verificar_dependencias_projeto
  if /i "%PROJETO_OK%"=="S" (
    echo Instalação de dependências ignorada porque os pacotes locais já estão presentes.
    exit /b 0
  )
  echo ERRO: as dependências locais obrigatórias não estão instaladas.
  exit /b 1
)
cmd /c npm.cmd install --include=dev
if errorlevel 1 exit /b 1
cmd /c npm.cmd --prefix backend install
if errorlevel 1 exit /b 1
call :verificar_dependencias_projeto_obrigatorio
exit /b %ERRORLEVEL%
:rodar_migracoes
echo.
echo [7/8] Rodando migrações do banco...
call :perguntar_sn RODAR_MIGRACOES "Rodar migrações agora" "S"
if /i not "%RODAR_MIGRACOES%"=="S" (
  echo Migrações ignoradas por escolha do usuário.
  exit /b 0
)
cmd /c npm.cmd run db:migrate
exit /b %ERRORLEVEL%
:testes_opcionais
echo.
echo [8/8] Validação opcional...
call :perguntar_sn RODAR_TESTES "Rodar testes, lint e build agora" "N"
if /i not "%RODAR_TESTES%"=="S" exit /b 0
cmd /c npm.cmd test -- --run
if errorlevel 1 exit /b 1
cmd /c npm.cmd --prefix backend test
if errorlevel 1 exit /b 1
cmd /c npm.cmd run lint
if errorlevel 1 exit /b 1
cmd /c npm.cmd run build
exit /b %ERRORLEVEL%
:iniciar_opcional
echo.
call :perguntar_sn INICIAR_APP "Iniciar backend e painel agora" "S"
if /i "%INICIAR_APP%"=="S" (
  call "%ROOT%\INICIAR_TUDO.bat"
)
exit /b 0
:verificar_dependencias_projeto
set "PROJETO_OK=S"
if exist "%ROOT%\node_modules\.bin\vite.cmd" (echo Vite local do painel: OK.) else (echo Vite local do painel: ausente. Rode npm install na raiz.& set "PROJETO_OK=N")
if exist "%ROOT%\node_modules\react" (echo React do painel: OK.) else (echo React do painel: ausente. Rode npm install na raiz.& set "PROJETO_OK=N")
if exist "%ROOT%\node_modules\react-dom" (echo React DOM do painel: OK.) else (echo React DOM do painel: ausente. Rode npm install na raiz.& set "PROJETO_OK=N")
if exist "%ROOT%\node_modules\qrcode" (echo QR Code do painel: OK.) else (echo QR Code do painel: ausente. Rode npm install na raiz.& set "PROJETO_OK=N")
if exist "%ROOT%\node_modules\lucide-react" (echo Ícones do painel: OK.) else (echo Ícones do painel: ausentes. Rode npm install na raiz.& set "PROJETO_OK=N")
if exist "%ROOT%\backend\node_modules\dotenv" (echo dotenv do backend: OK.) else (echo dotenv do backend: ausente. Rode npm --prefix backend install.& set "PROJETO_OK=N")
if exist "%ROOT%\backend\node_modules\express" (echo Express do backend: OK.) else (echo Express do backend: ausente. Rode npm --prefix backend install.& set "PROJETO_OK=N")
if exist "%ROOT%\backend\node_modules\cors" (echo CORS do backend: OK.) else (echo CORS do backend: ausente. Rode npm --prefix backend install.& set "PROJETO_OK=N")
if exist "%ROOT%\backend\node_modules\pg" (echo PostgreSQL client do backend: OK.) else (echo PostgreSQL client do backend: ausente. Rode npm --prefix backend install.& set "PROJETO_OK=N")
if exist "%ROOT%\backend\node_modules\multer" (echo Upload do backend: OK.) else (echo Upload do backend: ausente. Rode npm --prefix backend install.& set "PROJETO_OK=N")
if exist "%ROOT%\backend\node_modules\mercadopago" (echo Mercado Pago do backend: OK.) else (echo Mercado Pago do backend: ausente. Rode npm --prefix backend install.& set "PROJETO_OK=N")
if exist "%ROOT%\backend\node_modules\whatsapp-web.js" (echo whatsapp-web.js do backend: OK.) else (echo whatsapp-web.js do backend: ausente. Rode npm --prefix backend install.& set "PROJETO_OK=N")
if exist "%ROOT%\backend\node_modules\puppeteer" (echo Puppeteer/Chromium do backend: OK.) else (echo Puppeteer/Chromium do backend: ausente. Rode npm --prefix backend install.& set "PROJETO_OK=N")
if exist "%ROOT%\backend\node_modules\sharp" (echo Sharp do backend: OK.) else (echo Sharp do backend: ausente. Rode npm --prefix backend install.& set "PROJETO_OK=N")
if /i "%PROJETO_OK%"=="S" echo Dependências locais do SnapFlow: OK.
exit /b 0
:verificar_dependencias_projeto_obrigatorio
call :verificar_dependencias_projeto
if /i "%PROJETO_OK%"=="S" exit /b 0
echo ERRO: uma ou mais dependências locais continuam ausentes depois do npm install.
exit /b 1
:garantir_admin
net session >nul 2>nul
if not errorlevel 1 exit /b 0
echo ERRO: é necessário executar este arquivo como administrador para %~1.
echo Clique com o botão direito no BAT e escolha "Executar como administrador".
exit /b 1
:validar_identificador
set "VALIDAR_IDENT=%~2"
powershell -NoProfile -ExecutionPolicy Bypass -Command "if($env:VALIDAR_IDENT -match '^[A-Za-z_][A-Za-z0-9_]*$'){exit 0}else{exit 1}" >nul
if errorlevel 1 (
  echo ERRO: %~1 deve usar somente letras, números e underline, começando por letra ou underline.
  exit /b 1
)
exit /b 0
:validar_senha_banco
powershell -NoProfile -ExecutionPolicy Bypass -Command "if($env:POSTGRES_PASSWORD -match '^[A-Za-z0-9_-]{8,}$'){exit 0}else{exit 1}" >nul
if errorlevel 1 (
  echo ERRO: a senha do usuário SnapFlow deve ter pelo menos 8 caracteres e usar apenas letras, números, - ou _.
  exit /b 1
)
exit /b 0
:validar_porta
powershell -NoProfile -ExecutionPolicy Bypass -Command "$p=0; if([int]::TryParse($env:POSTGRES_PORT,[ref]$p) -and $p -ge 1024 -and $p -le 65535){exit 0}else{exit 1}" >nul
if errorlevel 1 (
  echo ERRO: informe uma porta entre 1024 e 65535.
  exit /b 1
)
exit /b 0
:perguntar
set "NOMEVAR=%~1"
set "PERGUNTA=%~2"
set "PADRAO=%~3"
set "RESPOSTA="
set /p "RESPOSTA=%PERGUNTA% (%PADRAO%): "
if not defined RESPOSTA set "RESPOSTA=%PADRAO%"
set "%NOMEVAR%=%RESPOSTA%"
exit /b 0
:perguntar_sn
call :perguntar "%~1" "%~2" "%~3"
call set "VALOR_SN=%%%~1%%"
if /i "%VALOR_SN%"=="SIM" set "%~1=S"& exit /b 0
if /i "%VALOR_SN%"=="S" set "%~1=S"& exit /b 0
if /i "%VALOR_SN%"=="YES" set "%~1=S"& exit /b 0
if /i "%VALOR_SN%"=="Y" set "%~1=S"& exit /b 0
set "%~1=N"
exit /b 0
:perguntar_secreto
for /f "usebackq delims=" %%A in (`powershell -NoProfile -ExecutionPolicy Bypass -Command "$p=Read-Host -AsSecureString '%~2'; $b=[Runtime.InteropServices.Marshal]::SecureStringToBSTR($p); try{[Runtime.InteropServices.Marshal]::PtrToStringBSTR($b)} finally{[Runtime.InteropServices.Marshal]::ZeroFreeBSTR($b)}"`) do set "%~1=%%A"
exit /b 0
:gerar_segredo
set "TAMANHO_SEGREDO=%~2"
if not defined TAMANHO_SEGREDO set "TAMANHO_SEGREDO=32"
for /f "usebackq delims=" %%A in (`powershell -NoProfile -ExecutionPolicy Bypass -Command "$n=[int]$env:TAMANHO_SEGREDO; if($n -le 0){$n=32}; $b=New-Object byte[] $n; [Security.Cryptography.RandomNumberGenerator]::Fill($b); [Convert]::ToBase64String($b).TrimEnd('=').Replace('+','-').Replace('/','_')"`) do set "%~1=%%A"
if not defined %~1 set "%~1=snapflow-%RANDOM%-%RANDOM%-%RANDOM%"
exit /b 0
:timestamp
for /f "usebackq delims=" %%A in (`powershell -NoProfile -ExecutionPolicy Bypass -Command "Get-Date -Format yyyyMMdd-HHmmss"`) do set "STAMP=%%A"
if not defined STAMP set "STAMP=%DATE%-%TIME%"
exit /b 0
:instalar_winget
echo Instalando %~1 via winget...
winget install --id %~2 -e --source winget --accept-package-agreements --accept-source-agreements
exit /b %ERRORLEVEL%
:mostrar_comando
echo.
echo %~1:
%~2
if errorlevel 1 (
  echo Resultado: não encontrado ou falhou.
) else (
  echo Resultado: OK.
)
exit /b 0
:falha
echo.
echo Instalação sem Docker interrompida por erro.
echo Revise as mensagens acima e rode este instalador novamente.
exit /b 1
