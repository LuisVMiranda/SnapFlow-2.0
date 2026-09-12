@echo off
setlocal EnableExtensions
chcp 65001 >nul
cd /d "%~dp0"
powershell -NoProfile -File "%~dp0scripts\configure-website-funnel.ps1"
if errorlevel 1 (
  echo Revise a mensagem acima. Se houver acesso negado, execute este arquivo como administrador.
  pause
  exit /b 1
)
endlocal
