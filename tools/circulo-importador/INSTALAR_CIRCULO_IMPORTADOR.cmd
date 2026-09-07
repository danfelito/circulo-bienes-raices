@echo off
chcp 65001 >nul
setlocal

set "IMPORTADOR_URL=https://circulointernacionalveracruz.org/admin/propiedades/importar"

powershell.exe -NoProfile -ExecutionPolicy Bypass -Command "$desktop=[Environment]::GetFolderPath('Desktop'); $shortcut=Join-Path $desktop 'Círculo Importador.url'; $contents=@('[InternetShortcut]','URL=%IMPORTADOR_URL%','IconFile='+$env:SystemRoot+'\System32\imageres.dll','IconIndex=105'); [IO.File]::WriteAllLines($shortcut,$contents,[Text.Encoding]::Unicode); Start-Process $shortcut"

if errorlevel 1 (
  echo.
  echo No se pudo crear el acceso directo.
  echo Abre este archivo con clic derecho y selecciona Ejecutar como administrador.
  pause
  exit /b 1
)

echo.
echo Listo: se creo "Círculo Importador" en tu escritorio.
echo A partir de ahora abre ese icono para cargar propiedades.
timeout /t 4 >nul

