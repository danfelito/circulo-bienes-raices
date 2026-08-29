$desktop = [Environment]::GetFolderPath('Desktop')
$launcher = Join-Path $PSScriptRoot 'ABRIR_CIRCULO_SYNC_WINDOWS.vbs'
$target = Join-Path $env:WINDIR 'System32\wscript.exe'
$icon = Join-Path $PSScriptRoot 'assets\circulo-media-sync.ico'
$shortcutPath = Join-Path $desktop 'Circulo Media Sync.lnk'
$shell = New-Object -ComObject WScript.Shell
$shortcut = $shell.CreateShortcut($shortcutPath)
$shortcut.TargetPath = $target
$shortcut.Arguments = '"' + $launcher + '"'
$shortcut.WorkingDirectory = $PSScriptRoot
$shortcut.Description = 'Optimiza y sincroniza propiedades con Circulo Internacional'
$shortcut.WindowStyle = 7

if (Test-Path $icon) {
  $shortcut.IconLocation = "$icon,0"
}

$shortcut.Save()
Write-Output "Acceso directo creado: $shortcutPath"
