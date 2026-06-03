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

call "%~dp0INICIAR_BANCO.bat" --skip-prepare
if errorlevel 1 (
  echo.
  echo Não foi possível iniciar o banco de dados ou aplicar as migrações.
  echo Corrija a mensagem acima e rode este arquivo novamente.
  pause
  exit /b 1
)

cd /d "%~dp0backend"
echo Iniciando servidor na porta 3000...
cmd /c npm.cmd start
endlocal
