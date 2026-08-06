@echo off
setlocal
cd /d "%~dp0"
title Circulo Media Sync

where node >nul 2>&1
if errorlevel 1 (
  echo.
  echo No se encontro Node.js 20 o superior.
  echo Instala Node.js LTS desde https://nodejs.org/ y vuelve a abrir este archivo.
  echo.
  pause
  exit /b 1
)

if not exist "node_modules\sharp" (
  echo Instalando componentes de Circulo Media Sync...
  call npm install
  if errorlevel 1 (
    echo.
    echo No fue posible instalar los componentes.
    pause
    exit /b 1
  )
)

echo Iniciando Circulo Media Sync...
node server.js
if errorlevel 1 pause
