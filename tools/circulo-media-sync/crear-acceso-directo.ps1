$desktop = [Environment]::GetFolderPath('Desktop')
$target = Join-Path $PSScriptRoot 'INICIAR_CIRCULO_SYNC_WINDOWS.cmd'
$shortcutPath = Join-Path $desktop 'Circulo Media Sync.lnk'
$shell = New-Object -ComObject WScript.Shell
$shortcut = $shell.CreateShortcut($shortcutPath)
$shortcut.TargetPath = $target
$shortcut.WorkingDirectory = $PSScriptRoot
$shortcut.Description = 'Optimiza y sincroniza propiedades con Circulo Internacional'
$shortcut.Save()
Write-Output "Acceso directo creado: $shortcutPath"
