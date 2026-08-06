@echo off
setlocal
cd /d "%~dp0"
title Instalar Circulo Media Sync

where node >nul 2>&1
if errorlevel 1 (
  echo.
  echo Debes instalar Node.js 20 o superior antes de continuar.
  echo Abre https://nodejs.org/ y selecciona la version LTS.
  echo.
  pause
  exit /b 1
)

call npm install
if errorlevel 1 (
  echo.
  echo La instalacion no termino correctamente.
  pause
  exit /b 1
)

powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0crear-acceso-directo.ps1"

echo.
echo Instalacion terminada. Se creo un acceso directo en el escritorio.
echo.
start "" "%~dp0INICIAR_CIRCULO_SYNC_WINDOWS.cmd"
