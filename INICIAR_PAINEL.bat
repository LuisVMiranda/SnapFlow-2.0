@echo off
title APP FOTOGRAFIA - PAINEL
cd /d "%~dp0"
echo Iniciando painel local em 127.0.0.1:5173...
call npm.cmd run dev -- --host 127.0.0.1 --port 5173
