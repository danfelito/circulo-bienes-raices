$endpoint = 'http://127.0.0.1:4317/api/state'

try {
  $state = Invoke-RestMethod -Uri $endpoint -Method Get -TimeoutSec 2
  if ($null -eq $state.settings -or $null -eq $state.properties) {
    exit 0
  }

  $connection = Get-NetTCPConnection -LocalAddress 127.0.0.1 -LocalPort 4317 -State Listen -ErrorAction SilentlyContinue |
    Select-Object -First 1

  if ($null -ne $connection -and $connection.OwningProcess) {
    Stop-Process -Id $connection.OwningProcess -Force -ErrorAction Stop
    Start-Sleep -Milliseconds 700
    Write-Output 'Instancia anterior de Circulo Media Sync cerrada.'
  }
} catch {
  # No había una instancia compatible activa. La instalación puede continuar.
}
