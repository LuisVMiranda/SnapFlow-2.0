@echo off
setlocal EnableExtensions
chcp 65001 >nul

cd /d "%~dp0." || (
  echo Não foi possível entrar na pasta do SnapFlow.
  exit /b 1
)
set "ROOT=%CD%"

if /i "%~1"=="--ajuda" goto ajuda
if /i "%~1"=="--verificar" goto modo_verificar

call :cabecalho
echo Este instalador prepara o SnapFlow neste computador Windows.
echo Ele pode instalar Git, Node.js LTS e Docker Desktop via winget, criar arquivos locais de configuração,
echo instalar pacotes npm, subir o PostgreSQL, rodar migrações e iniciar o painel.
echo.
echo Nenhum segredo gerado aqui deve ser enviado ao Git. Os arquivos .env locais já são ignorados.
echo.

call :perguntar_sn CONTINUAR "Continuar com a instalação guiada" "S"
if /i not "%CONTINUAR%"=="S" (
  echo Instalação cancelada pelo usuário.
  exit /b 0
)

call :checar_powershell || goto falha
call :preparar_dependencias || goto falha
call :coletar_configuracao || goto falha
call :escrever_configuracao || goto falha
call :instalar_dependencias_npm || goto falha
call :preparar_banco || goto falha
call :rodar_migracoes || goto falha
call :testes_opcionais || goto falha
call :iniciar_opcional || goto falha

echo.
echo Instalação concluída.
echo Painel local: %PUBLIC_BASE_URL%
echo API local: http://%HOST%:%PORT%
echo Token administrativo configurado: %ADMIN_ACCESS_TOKEN%
echo.
echo Guarde esse token. Ele será usado no botão Conta do painel.
exit /b 0

:ajuda
call :cabecalho
echo Uso:
echo   INSTALAR_SNAPFLOW.bat
echo   INSTALAR_SNAPFLOW.bat --verificar
echo   INSTALAR_SNAPFLOW.bat --ajuda
echo.
echo O modo normal instala e configura de forma interativa.
echo O modo --verificar apenas confere comandos e ambiente sem alterar arquivos.
exit /b 0

:modo_verificar
call :cabecalho
echo Modo de verificação. Nenhum arquivo será criado ou alterado.
echo.
call :mostrar_comando "Git" "git --version"
call :mostrar_comando "Node.js" "node --version"
call :mostrar_comando "npm" "cmd /c npm.cmd --version"
call :mostrar_comando "Docker" "docker --version"
call :mostrar_comando "Docker Compose" "docker compose version"
call :mostrar_comando "Configuração do Docker Compose" "docker compose config"
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
echo Verificação concluída.
exit /b 0

:cabecalho
echo.
echo ============================================================
echo              INSTALADOR SNAPFLOW 2.0
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

:preparar_dependencias
echo.
echo [1/7] Verificando dependências do Windows...
where winget >nul 2>nul
if errorlevel 1 (
  set "WINGET_OK=N"
  echo winget não foi encontrado. Dependências ausentes precisarão ser instaladas manualmente.
) else (
  set "WINGET_OK=S"
  for /f "delims=" %%A in ('winget --version 2^>nul') do echo winget encontrado: %%A
)

call :perguntar_sn AUTO_INSTALL "Instalar automaticamente dependências ausentes via winget" "S"

call :garantir_git || goto falha_dependencia
call :garantir_node || goto falha_dependencia
call :garantir_docker || goto falha_dependencia
exit /b 0

:falha_dependencia
echo.
echo Não foi possível preparar todas as dependências obrigatórias.
echo Instale o item indicado acima, feche e abra o terminal novamente, e rode este instalador outra vez.
exit /b 1

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

:garantir_docker
where docker >nul 2>nul
if errorlevel 1 (
  echo Docker não foi encontrado.
  if /i "%AUTO_INSTALL%"=="S" if /i "%WINGET_OK%"=="S" (
    call :instalar_winget "Docker Desktop" "Docker.DockerDesktop"
    set "PATH=%PATH%;%ProgramFiles%\Docker\Docker\resources\bin"
  )
)

where docker >nul 2>nul
if errorlevel 1 (
  echo Docker ainda não foi encontrado.
  exit /b 1
)

docker --version
docker compose version >nul 2>nul
if errorlevel 1 (
  echo Docker Compose não respondeu corretamente.
  exit /b 1
)

docker info >nul 2>nul
if not errorlevel 1 (
  echo Docker Desktop está rodando.
  exit /b 0
)

echo Docker Desktop foi encontrado, mas o engine não respondeu.
call :perguntar_sn ABRIR_DOCKER "Abrir o Docker Desktop agora" "S"
if /i "%ABRIR_DOCKER%"=="S" (
  if exist "%ProgramFiles%\Docker\Docker\Docker Desktop.exe" start "" "%ProgramFiles%\Docker\Docker\Docker Desktop.exe"
)
call :aguardar_docker_engine
exit /b %ERRORLEVEL%

:aguardar_docker_engine
set "DOCKER_TENTATIVA=0"
echo Aguardando o Docker Desktop ficar pronto. Isso pode levar alguns minutos na primeira inicialização.

:aguardar_docker_loop
docker info >nul 2>nul
if not errorlevel 1 (
  echo.
  echo Docker Desktop está rodando.
  exit /b 0
)
set /a DOCKER_TENTATIVA+=1
if %DOCKER_TENTATIVA% GEQ 40 goto docker_timeout
<nul set /p "=."
timeout /t 3 /nobreak >nul
goto aguardar_docker_loop

:docker_timeout
echo.
echo O Docker Desktop ainda não respondeu.
echo Confira se o Docker Desktop está aberto, sem tela de instalação pendente, e com status indicando que o engine está rodando.
call :perguntar_sn AGUARDAR_DOCKER_MAIS "Aguardar mais 2 minutos pelo Docker Desktop" "S"
if /i "%AGUARDAR_DOCKER_MAIS%"=="S" (
  set "DOCKER_TENTATIVA=0"
  goto aguardar_docker_loop
)
echo Abra o Docker Desktop, aguarde o status ficar pronto, e rode INSTALAR_SNAPFLOW.bat novamente.
exit /b 1

:instalar_winget
echo Instalando %~1 via winget...
winget install --id %~2 -e --source winget --accept-package-agreements --accept-source-agreements
exit /b %ERRORLEVEL%

:coletar_configuracao
echo.
echo [2/7] Coletando configuração local...
echo Pressione ENTER para aceitar o valor padrão entre parênteses.
echo.

call :gerar_segredo DB_PASS_DEFAULT 24
call :gerar_segredo ADMIN_DEFAULT 32
call :gerar_segredo CREDENTIALS_DEFAULT 32
call :gerar_segredo WEBHOOK_DEFAULT 32

call :perguntar POSTGRES_DB "Nome do banco PostgreSQL" "snapflow"
call :perguntar POSTGRES_USER "Usuário do banco PostgreSQL" "snapflow"
call :perguntar POSTGRES_PASSWORD "Senha do PostgreSQL sem @, : ou /" "%DB_PASS_DEFAULT%"
call :perguntar POSTGRES_PORT "Porta local do PostgreSQL" "55432"
call :perguntar ADMIN_ACCESS_TOKEN "Token administrativo do painel" "%ADMIN_DEFAULT%"
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

:escrever_configuracao
echo.
echo [3/7] Criando arquivos locais de configuração...
call :timestamp

if exist "%ROOT%\.env" (
  call :perguntar_sn SOBRESCREVER_ROOT_ENV "O arquivo .env da raiz já existe. Substituir após backup" "N"
) else (
  set "SOBRESCREVER_ROOT_ENV=S"
)

if exist "%ROOT%\backend\.env.local" (
  call :perguntar_sn SOBRESCREVER_BACKEND_ENV "O arquivo backend\.env.local já existe. Substituir após backup" "N"
) else (
  set "SOBRESCREVER_BACKEND_ENV=S"
)

if /i "%SOBRESCREVER_ROOT_ENV%"=="S" (
  if exist "%ROOT%\.env" copy /Y "%ROOT%\.env" "%ROOT%\.env.bak-%STAMP%" >nul
  set "SNAPFLOW_ROOT=%ROOT%"
  powershell -NoProfile -ExecutionPolicy Bypass -Command "$root=$env:SNAPFLOW_ROOT; $lines=@('POSTGRES_DB='+$env:POSTGRES_DB,'POSTGRES_USER='+$env:POSTGRES_USER,'POSTGRES_PASSWORD='+$env:POSTGRES_PASSWORD,'POSTGRES_PORT='+$env:POSTGRES_PORT,'SNAPFLOW_DEV_HOST='+$env:FRONTEND_HOST,'SNAPFLOW_DEV_PORT='+$env:FRONTEND_PORT,'SNAPFLOW_ALLOWED_HOSTS='+$env:SNAPFLOW_ALLOWED_HOSTS); [IO.File]::WriteAllLines((Join-Path $root '.env'), $lines, [Text.UTF8Encoding]::new($false))"
  if errorlevel 1 exit /b 1
  echo Criado: .env
) else (
  echo Mantido: .env existente
)

if /i "%SOBRESCREVER_BACKEND_ENV%"=="S" (
  if exist "%ROOT%\backend\.env.local" copy /Y "%ROOT%\backend\.env.local" "%ROOT%\backend\.env.local.bak-%STAMP%" >nul
  set "SNAPFLOW_ROOT=%ROOT%"
  powershell -NoProfile -ExecutionPolicy Bypass -Command "$root=$env:SNAPFLOW_ROOT; $db='postgres://'+$env:POSTGRES_USER+':'+$env:POSTGRES_PASSWORD+'@127.0.0.1:'+$env:POSTGRES_PORT+'/'+$env:POSTGRES_DB; $lines=@('DATABASE_URL='+$db,'ADMIN_ACCESS_TOKEN='+$env:ADMIN_ACCESS_TOKEN,'CREDENTIALS_SECRET='+$env:CREDENTIALS_SECRET,'MP_ACCESS_TOKEN='+$env:MP_ACCESS_TOKEN,'MP_WEBHOOK_SECRET='+$env:MP_WEBHOOK_SECRET,'PUBLIC_BASE_URL='+$env:PUBLIC_BASE_URL,'HOST='+$env:HOST,'PORT='+$env:PORT,'STORAGE_ROOT='+$env:STORAGE_ROOT,'MAX_UPLOAD_MB=25','MAX_FILES_PER_UPLOAD=100','DEFAULT_GALLERY_RETENTION_DAYS=30','DELIVERED_PHOTO_RETENTION_DAYS=30','EXPIRED_SHARE_RETENTION_DAYS=7','AUTO_CLEANUP_ENABLED='+$env:AUTO_CLEANUP_ENABLED); [IO.File]::WriteAllLines((Join-Path $root 'backend\.env.local'), $lines, [Text.UTF8Encoding]::new($false))"
  if errorlevel 1 exit /b 1
  echo Criado: backend\.env.local
) else (
  echo Mantido: backend\.env.local existente
)
exit /b 0

:instalar_dependencias_npm
echo.
echo [4/7] Instalando dependências npm...
call :perguntar_sn INSTALAR_NPM "Rodar npm install na raiz e no backend" "S"
if /i not "%INSTALAR_NPM%"=="S" (
  call :verificar_dependencias_projeto
  if /i "%PROJETO_OK%"=="S" (
    echo Instalação de dependências ignorada porque os pacotes locais já estão presentes.
    exit /b 0
  )
  echo.
  echo ERRO: as dependências locais obrigatórias não estão instaladas.
  echo Sem elas o painel exibirá erro de Vite ausente e o backend exibirá módulos como dotenv ausentes.
  echo Rode este instalador novamente e aceite a etapa de npm install.
  exit /b 1
)
cmd /c npm.cmd install
if errorlevel 1 exit /b 1
cmd /c npm.cmd --prefix backend install
if errorlevel 1 exit /b 1
call :verificar_dependencias_projeto_obrigatorio
if errorlevel 1 exit /b 1
exit /b 0

:verificar_dependencias_projeto
set "PROJETO_OK=S"
if exist "%ROOT%\node_modules\.bin\vite.cmd" (
  echo Vite local do painel: OK.
) else (
  echo Vite local do painel: ausente. Rode npm install na raiz.
  set "PROJETO_OK=N"
)
if exist "%ROOT%\node_modules\react" (
  echo React do painel: OK.
) else (
  echo React do painel: ausente. Rode npm install na raiz.
  set "PROJETO_OK=N"
)
if exist "%ROOT%\node_modules\react-dom" (
  echo React DOM do painel: OK.
) else (
  echo React DOM do painel: ausente. Rode npm install na raiz.
  set "PROJETO_OK=N"
)
if exist "%ROOT%\node_modules\qrcode" (
  echo QR Code do painel: OK.
) else (
  echo QR Code do painel: ausente. Rode npm install na raiz.
  set "PROJETO_OK=N"
)
if exist "%ROOT%\node_modules\lucide-react" (
  echo Ícones do painel: OK.
) else (
  echo Ícones do painel: ausentes. Rode npm install na raiz.
  set "PROJETO_OK=N"
)
if exist "%ROOT%\backend\node_modules\dotenv" (
  echo dotenv do backend: OK.
) else (
  echo dotenv do backend: ausente. Rode npm --prefix backend install.
  set "PROJETO_OK=N"
)
if exist "%ROOT%\backend\node_modules\express" (
  echo Express do backend: OK.
) else (
  echo Express do backend: ausente. Rode npm --prefix backend install.
  set "PROJETO_OK=N"
)
if exist "%ROOT%\backend\node_modules\cors" (
  echo CORS do backend: OK.
) else (
  echo CORS do backend: ausente. Rode npm --prefix backend install.
  set "PROJETO_OK=N"
)
if exist "%ROOT%\backend\node_modules\pg" (
  echo PostgreSQL client do backend: OK.
) else (
  echo PostgreSQL client do backend: ausente. Rode npm --prefix backend install.
  set "PROJETO_OK=N"
)
if exist "%ROOT%\backend\node_modules\multer" (
  echo Upload do backend: OK.
) else (
  echo Upload do backend: ausente. Rode npm --prefix backend install.
  set "PROJETO_OK=N"
)
if exist "%ROOT%\backend\node_modules\mercadopago" (
  echo Mercado Pago do backend: OK.
) else (
  echo Mercado Pago do backend: ausente. Rode npm --prefix backend install.
  set "PROJETO_OK=N"
)
if exist "%ROOT%\backend\node_modules\whatsapp-web.js" (
  echo whatsapp-web.js do backend: OK.
) else (
  echo whatsapp-web.js do backend: ausente. Rode npm --prefix backend install.
  set "PROJETO_OK=N"
)
if exist "%ROOT%\backend\node_modules\puppeteer" (
  echo Puppeteer/Chromium do backend: OK.
) else (
  echo Puppeteer/Chromium do backend: ausente. Rode npm --prefix backend install.
  set "PROJETO_OK=N"
)
if exist "%ROOT%\backend\node_modules\sharp" (
  echo Sharp do backend: OK.
) else (
  echo Sharp do backend: ausente. Rode npm --prefix backend install.
  set "PROJETO_OK=N"
)
if /i "%PROJETO_OK%"=="S" echo Dependências locais do SnapFlow: OK.
exit /b 0

:verificar_dependencias_projeto_obrigatorio
call :verificar_dependencias_projeto
if /i "%PROJETO_OK%"=="S" exit /b 0
echo.
echo ERRO: uma ou mais dependências locais continuam ausentes depois do npm install.
echo Verifique sua conexão com a internet, permissões da pasta e mensagens do npm acima.
exit /b 1

:preparar_banco
echo.
echo [5/7] Preparando PostgreSQL local...
call :perguntar_sn SUBIR_BANCO "Subir PostgreSQL pelo Docker Compose" "S"
if /i not "%SUBIR_BANCO%"=="S" (
  echo Banco não foi iniciado por escolha do usuário.
  exit /b 0
)
cmd /c npm.cmd run db:up
if errorlevel 1 exit /b 1
call :aguardar_postgres
exit /b %ERRORLEVEL%

:aguardar_postgres
echo Aguardando PostgreSQL ficar pronto...
for /l %%I in (1,1,30) do (
  docker exec snapflow-postgres pg_isready -U "%POSTGRES_USER%" -d "%POSTGRES_DB%" >nul 2>nul
  if not errorlevel 1 (
    echo PostgreSQL pronto.
    exit /b 0
  )
  timeout /t 2 /nobreak >nul
)
echo PostgreSQL não ficou pronto dentro do tempo esperado.
exit /b 1

:rodar_migracoes
echo.
echo [6/7] Rodando migrações do banco...
call :perguntar_sn RODAR_MIGRACOES "Rodar migrações agora" "S"
if /i not "%RODAR_MIGRACOES%"=="S" (
  echo Migrações ignoradas por escolha do usuário.
  exit /b 0
)
cmd /c npm.cmd run db:migrate
exit /b %ERRORLEVEL%

:testes_opcionais
echo.
echo [7/7] Validação opcional...
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
if /i "%SNAPFLOW_SKIP_FINAL_START%"=="S" (
  echo Inicialização automática ignorada porque o instalador foi chamado por um script de início.
  exit /b 0
)
call :perguntar_sn INICIAR_APP "Iniciar backend e painel agora" "S"
if /i "%INICIAR_APP%"=="S" (
  call "%ROOT%\INICIAR_TUDO.bat"
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
if /i "%VALOR_SN%"=="SIM" (
  set "%~1=S"
  exit /b 0
)
if /i "%VALOR_SN%"=="S" (
  set "%~1=S"
  exit /b 0
)
if /i "%VALOR_SN%"=="YES" (
  set "%~1=S"
  exit /b 0
)
if /i "%VALOR_SN%"=="Y" (
  set "%~1=S"
  exit /b 0
)
set "%~1=N"
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
echo Instalação interrompida por erro.
echo Revise as mensagens acima e rode este instalador novamente.
exit /b 1
