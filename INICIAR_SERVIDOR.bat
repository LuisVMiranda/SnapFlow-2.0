@echo off
title APP FOTOGRAFIA - SERVIDOR
cd /d "%~dp0backend"
echo Iniciando servidor na porta 3000...
node server.js
