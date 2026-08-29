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

node -e "process.exit(Number(process.versions.node.split('.')[0]) >= 20 ? 0 : 1)"
if errorlevel 1 (
  echo.
  echo La version instalada de Node.js es demasiado antigua.
  echo Instala Node.js 20 LTS o superior desde https://nodejs.org/
  echo.
  pause
  exit /b 1
)

powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0cerrar-instancia-anterior.ps1"

call npm install
if errorlevel 1 (
  echo.
  echo La instalacion no termino correctamente.
  pause
  exit /b 1
)

powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0crear-acceso-directo.ps1"
if errorlevel 1 (
  echo.
  echo No fue posible crear el acceso directo en el escritorio.
  pause
  exit /b 1
)

echo.
echo Instalacion terminada.
echo Se creo el acceso directo "Circulo Media Sync" en el escritorio.
echo.
start "" wscript.exe "%~dp0ABRIR_CIRCULO_SYNC_WINDOWS.vbs"
