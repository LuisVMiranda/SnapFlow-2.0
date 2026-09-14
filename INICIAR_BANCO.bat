@echo off
rem Keep this launcher in CRLF; cmd.exe misparses mixed line endings.
setlocal EnableExtensions
chcp 65001 >nul
title APP FOTOGRAFIA - BANCO
cd /d "%~dp0" || exit /b 1
set "CHECK_ONLY=N"
set "SKIP_PREPARE=N"
set "MIGRATION_ARGUMENT="

:ler_args
if "%~1"=="" goto args_lidos
if /i "%~1"=="--verificar" set "CHECK_ONLY=S"
if /i "%~1"=="--skip-prepare" set "SKIP_PREPARE=S"
if /i "%~1"=="--sem-migracoes" set "MIGRATION_ARGUMENT=--sem-migracoes"
shift
goto ler_args

:args_lidos
if /i "%CHECK_ONLY%"=="S" goto verificar
if /i not "%SKIP_PREPARE%"=="S" (
  call "%~dp0PREPARAR_DEPENDENCIAS_LOCAIS.bat" servidor
  if errorlevel 1 goto falha
)
node scripts\start-database.mjs %MIGRATION_ARGUMENT%
if errorlevel 1 goto falha
exit /b 0

:verificar
echo Verificando scripts do banco sem iniciar servicos...
for %%F in (run-docker-compose.mjs sync-docker-env.mjs startup-command.mjs database-startup-config.mjs start-database.mjs) do (
  node --check "scripts\%%F"
  if errorlevel 1 goto falha
)
node --check scripts\snapflow-startup.mjs
if errorlevel 1 goto falha
echo Verificacao do banco concluida.
exit /b 0

:falha
echo.
echo O banco nao ficou pronto. Veja a mensagem acima e logs\database-startup.log.
echo Corrija a causa e execute novamente. Os dados existentes foram preservados.
if /i "%SKIP_PREPARE%"=="N" pause
exit /b 1
