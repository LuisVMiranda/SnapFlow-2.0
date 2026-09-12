@echo off
setlocal EnableExtensions
chcp 65001 >nul
cd /d "%~dp0"
title APP FOTOGRAFIA - WEBSITE
call "%~dp0PREPARAR_DEPENDENCIAS_LOCAIS.bat" painel
if errorlevel 1 exit /b 1
if exist "%~dp0.env" (
  for /f "usebackq tokens=1,* delims==" %%A in ("%~dp0.env") do (
    if /i "%%A"=="SNAPFLOW_WEBSITE_PORT" set "SNAPFLOW_WEBSITE_PORT=%%B"
    if /i "%%A"=="SNAPFLOW_DEV_PORT" set "SNAPFLOW_DEV_PORT=%%B"
    if /i "%%A"=="SNAPFLOW_API_PORT" set "SNAPFLOW_API_PORT=%%B"
  )
)
if exist "%~dp0backend\.env.local" (
  for /f "usebackq tokens=1,* delims==" %%A in ("%~dp0backend\.env.local") do (
    if /i "%%A"=="PORT" set "SNAPFLOW_API_PORT=%%B"
  )
)
if "%SNAPFLOW_WEBSITE_PORT%"=="" set "SNAPFLOW_WEBSITE_PORT=5174"
if "%SNAPFLOW_DEV_PORT%"=="" set "SNAPFLOW_DEV_PORT=5173"
if "%SNAPFLOW_API_PORT%"=="" set "SNAPFLOW_API_PORT=3000"
node scripts\snapflow-startup.mjs assert-distinct "%SNAPFLOW_API_PORT%" "%SNAPFLOW_DEV_PORT%" "%SNAPFLOW_WEBSITE_PORT%"
if errorlevel 1 exit /b 1
node scripts\snapflow-startup.mjs assert-port website "%SNAPFLOW_WEBSITE_PORT%"
if errorlevel 1 exit /b 1
node scripts\snapflow-startup.mjs wait-api "http://127.0.0.1:%SNAPFLOW_API_PORT%/api/health" 30 1000
if errorlevel 1 exit /b 1
cmd /c npm.cmd run dev:website
endlocal
