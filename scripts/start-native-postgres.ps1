$ErrorActionPreference = 'Stop'
try {
  $requested = $env:SNAPFLOW_POSTGRES_SERVICE
  if ($requested) {
    if ($requested -notmatch '^postgresql[a-zA-Z0-9_-]*$') { throw 'Nome POSTGRES_SERVICE invalido.' }
    $services = @(Get-Service -Name $requested -ErrorAction Stop)
  } else {
    $services = @(Get-Service -Name 'postgresql*' -ErrorAction SilentlyContinue)
  }
  if ($services.Count -eq 0) { throw 'Servico PostgreSQL nao encontrado. Confira o modo de banco ou o instalador sem Docker.' }
  if ($services.Count -gt 1) { throw 'Mais de um servico PostgreSQL encontrado. Defina POSTGRES_SERVICE no .env com o nome correto.' }
  $service = $services[0]
  if ($service.Status -ne 'Running') {
    Write-Output "Iniciando servico $($service.Name)..."
    Start-Service -InputObject $service -ErrorAction Stop
    $service.WaitForStatus('Running', [TimeSpan]::FromSeconds(20))
  }
  Write-Output "Servico PostgreSQL rodando: $($service.Name)"
} catch {
  Write-Output "ERRO: $($_.Exception.Message)"
  Write-Output 'Se o acesso foi negado, execute o iniciador como administrador ou inicie o servico no Windows.'
  exit 1
}
