@echo off
setlocal EnableExtensions
chcp 65001 >nul
title APP FOTOGRAFIA - SERVIDOR
cd /d "%~dp0"
call "%~dp0PREPARAR_DEPENDENCIAS_LOCAIS.bat" servidor
if errorlevel 1 exit /b 1

cd /d "%~dp0backend"
echo Iniciando servidor na porta 3000...
cmd /c npm.cmd start
endlocal
