@echo off
title APP FOTOGRAFIA - PAINEL
cd /d "%~dp0"
echo Iniciando painel em rede local e Tailscale...
call npm.cmd run dev -- --host 0.0.0.0 --port 5173
