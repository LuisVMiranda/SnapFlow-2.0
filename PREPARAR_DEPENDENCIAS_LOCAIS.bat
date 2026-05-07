@echo off
setlocal EnableExtensions
chcp 65001 >nul

cd /d "%~dp0" || (
  echo ERRO: não foi possível entrar na pasta do SnapFlow.
  exit /b 1
)
set "ROOT=%CD%"
set "MODO=%~1"
if "%MODO%"=="" set "MODO=tudo"

call :garantir_node_npm || exit /b 1

if /i "%MODO%"=="painel" (
  call :garantir_painel
  if errorlevel 1 exit /b 1
  exit /b 0
)

if /i "%MODO%"=="servidor" (
  call :garantir_servidor
  if errorlevel 1 exit /b 1
  exit /b 0
)

if /i "%MODO%"=="tudo" (
  call :garantir_painel || exit /b 1
  call :garantir_servidor || exit /b 1
  echo Dependências locais prontas.
  exit /b 0
)

echo ERRO: modo inválido. Use painel, servidor ou tudo.
exit /b 1

:garantir_node_npm
where node >nul 2>nul
if errorlevel 1 (
  echo ERRO: Node.js não foi encontrado.
  echo Rode INSTALAR_SNAPFLOW.bat para instalar Node.js LTS e preparar o ambiente.
  exit /b 1
)

node -e "const v=process.versions.node.split('.').map(Number); const ok=(v[0]===20&&v[1]>=19)||(v[0]===22&&v[1]>=13)||v[0]>=24; process.exit(ok?0:1)" >nul 2>nul
if errorlevel 1 (
  for /f "delims=" %%A in ('node --version 2^>nul') do echo ERRO: Node.js incompatível encontrado: %%A
  echo Instale Node.js 20.19+, 22.13+ ou 24+ pelo INSTALAR_SNAPFLOW.bat.
  exit /b 1
)

where npm.cmd >nul 2>nul
if errorlevel 1 (
  echo ERRO: npm.cmd não foi encontrado junto com o Node.js.
  echo Reinstale o Node.js LTS pelo INSTALAR_SNAPFLOW.bat.
  exit /b 1
)
exit /b 0

:garantir_painel
if exist "%ROOT%\node_modules\.bin\vite.cmd" if exist "%ROOT%\node_modules\react" if exist "%ROOT%\node_modules\react-dom" if exist "%ROOT%\node_modules\qrcode" if exist "%ROOT%\node_modules\lucide-react" exit /b 0

echo.
echo Dependências do painel ausentes.
echo Isso causa erros como "'vite' não é reconhecido" ao iniciar o painel.
call :perguntar_sn INSTALAR_FRONTEND "Instalar dependências do painel agora com npm install" "S"
if /i not "%INSTALAR_FRONTEND%"=="S" (
  echo Painel não pode iniciar sem as dependências locais.
  exit /b 1
)

cmd /c npm.cmd install
if errorlevel 1 exit /b 1

if exist "%ROOT%\node_modules\.bin\vite.cmd" if exist "%ROOT%\node_modules\react" if exist "%ROOT%\node_modules\react-dom" if exist "%ROOT%\node_modules\qrcode" if exist "%ROOT%\node_modules\lucide-react" exit /b 0
echo ERRO: npm install terminou, mas módulos obrigatórios do painel ainda não foram encontrados em node_modules.
exit /b 1

:garantir_servidor
if exist "%ROOT%\backend\node_modules\dotenv" if exist "%ROOT%\backend\node_modules\express" if exist "%ROOT%\backend\node_modules\cors" if exist "%ROOT%\backend\node_modules\pg" if exist "%ROOT%\backend\node_modules\multer" if exist "%ROOT%\backend\node_modules\mercadopago" if exist "%ROOT%\backend\node_modules\whatsapp-web.js" if exist "%ROOT%\backend\node_modules\puppeteer" if exist "%ROOT%\backend\node_modules\sharp" goto servidor_config

echo.
echo Dependências do backend ausentes.
echo Isso causa erros como "Cannot find module 'dotenv'" ao iniciar o servidor.
call :perguntar_sn INSTALAR_BACKEND "Instalar dependências do backend agora com npm --prefix backend install" "S"
if /i not "%INSTALAR_BACKEND%"=="S" (
  echo Servidor não pode iniciar sem as dependências locais do backend.
  exit /b 1
)

cmd /c npm.cmd --prefix backend install
if errorlevel 1 exit /b 1

if exist "%ROOT%\backend\node_modules\dotenv" if exist "%ROOT%\backend\node_modules\express" if exist "%ROOT%\backend\node_modules\cors" if exist "%ROOT%\backend\node_modules\pg" if exist "%ROOT%\backend\node_modules\multer" if exist "%ROOT%\backend\node_modules\mercadopago" if exist "%ROOT%\backend\node_modules\whatsapp-web.js" if exist "%ROOT%\backend\node_modules\puppeteer" if exist "%ROOT%\backend\node_modules\sharp" goto servidor_config
echo ERRO: npm --prefix backend install terminou, mas módulos obrigatórios ainda estão ausentes.
exit /b 1

:servidor_config
if exist "%ROOT%\backend\.env.local" exit /b 0

echo.
echo Configuração local backend\.env.local não encontrada.
echo O servidor precisa desse arquivo para DATABASE_URL, token administrativo e segredos locais.
call :perguntar_sn RODAR_INSTALADOR "Rodar INSTALAR_SNAPFLOW.bat para configurar o ambiente agora" "S"
if /i not "%RODAR_INSTALADOR%"=="S" exit /b 1

set "SNAPFLOW_SKIP_FINAL_START=S"
call "%ROOT%\INSTALAR_SNAPFLOW.bat"
if errorlevel 1 exit /b 1
if exist "%ROOT%\backend\.env.local" exit /b 0
echo ERRO: backend\.env.local ainda não existe depois do instalador.
exit /b 1

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
