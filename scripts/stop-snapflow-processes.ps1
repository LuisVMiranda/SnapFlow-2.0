param(
  [Parameter(Mandatory = $true)]
  [ValidateRange(1, 65535)]
  [int] $ApiPort,
  [Parameter(Mandatory = $true)]
  [ValidateRange(1, 65535)]
  [int] $PanelPort,
  [Parameter(Mandatory = $true)]
  [ValidateRange(1, 65535)]
  [int] $WebsitePort,
  [Parameter(Mandatory = $true)]
  [string] $RootPath,
  [string] $LogDirectory = 'logs'
)

$ErrorActionPreference = 'Stop'

function Get-ProcessSnapshot {
  param([int] $ProcessId)

  try {
    $snapshot = Get-CimInstance Win32_Process -Filter "ProcessId = $ProcessId" -ErrorAction Stop
    if ($null -ne $snapshot) { return $snapshot }
  } catch {
    # Fall back to the local process table when CIM access is restricted.
  }
  try {
    $process = Get-Process -Id $ProcessId -ErrorAction Stop
    return [pscustomobject]@{
      CommandLine = ''
      Name = $process.ProcessName
      ProcessId = $process.Id
    }
  } catch { return $null }
}

function Get-PortProcessIds {
  param([int] $Port)

  if (Get-Command Get-NetTCPConnection -ErrorAction SilentlyContinue) {
    $connections = @(Get-NetTCPConnection -State Listen -LocalPort $Port -ErrorAction SilentlyContinue |
      Select-Object -ExpandProperty OwningProcess -Unique)
    if ($connections.Count -gt 0) { return $connections }
  }
  $portPattern = ":$Port\s+\S+\s+LISTENING\s+(\d+)\s*$"
  $fallbackIds = foreach ($line in (& netstat.exe -ano -p tcp 2>$null)) {
    if ($line -match $portPattern) { [int] $Matches[1] }
  }
  return @($fallbackIds | Sort-Object -Unique)
}

function Get-RecordedProcessIds {
  param([string] $Directory, [string] $Name)

  $path = Join-Path $Directory "$Name.pid"
  if (-not (Test-Path -LiteralPath $path)) { return @() }
  try { return @([int](Get-Content -Raw -LiteralPath $path).Trim()) } catch { return @() }
}

function Test-SnapFlowProcess {
  param($Snapshot, [string] $Root, [string] $Service, [switch] $Recorded)

  if ($null -eq $Snapshot) { return $false }
  $processName = ([string] $Snapshot.Name).ToLowerInvariant()
  if ($Recorded -and $processName -match '^(cmd|node|npm)(\.exe)?$') { return $true }
  $line = ([string] $Snapshot.CommandLine).ToLowerInvariant()
  if ($line.Contains($Root.ToLowerInvariant().TrimEnd('\'))) { return $true }
  switch ($Service) {
    'api' { return $line.Contains('server.js') -or $line.Contains('npm-cli.js start') -or $line.Contains('npm.cmd start') }
    'panel' { return $line.Contains('npm-cli.js run dev') -or $line.Contains('npm.cmd run dev') -or ($line.Contains('vite') -and $line.Contains('--host')) }
    'website' { return $line.Contains('dev:website') -or $line.Contains('vite.website.config.js') }
    default { return $false }
  }
}

function Stop-ProcessTree {
  param([int] $ProcessId)

  & taskkill.exe /PID $ProcessId /T /F 2>$null | Out-Null
  if ($LASTEXITCODE -ne 0 -and $null -ne (Get-ProcessSnapshot $ProcessId)) {
    throw "Nao foi possivel encerrar o processo $ProcessId."
  }
}

try {
  $root = (Resolve-Path -LiteralPath $RootPath).Path.TrimEnd('\')
  $logDirectoryPath = Join-Path $root $LogDirectory
  $services = @(
    @{ Name = 'api'; Label = 'API'; Port = $ApiPort },
    @{ Name = 'panel'; Label = 'painel'; Port = $PanelPort },
    @{ Name = 'website'; Label = 'website'; Port = $WebsitePort }
  )
  $stopped = @{}

  foreach ($service in $services) {
    $recordedIds = @(Get-RecordedProcessIds -Directory $logDirectoryPath -Name $service.Name)
    $processIds = @($recordedIds)
    $processIds += @(Get-PortProcessIds -Port $service.Port)
    foreach ($processId in ($processIds | Sort-Object -Unique)) {
      $snapshot = Get-ProcessSnapshot ([int] $processId)
      if ($null -eq $snapshot -or $stopped.ContainsKey([string] $processId)) { continue }
      $isRecorded = $recordedIds -contains ([int] $processId)
      if (-not (Test-SnapFlowProcess -Snapshot $snapshot -Root $root -Service $service.Name -Recorded:$isRecorded)) {
        throw "Processo SnapFlow nao identificado na porta $($service.Port) ($($service.Label)), PID $processId."
      }
      Write-Output "Encerrando $($service.Label) anterior (PID $processId)..."
      Stop-ProcessTree ([int] $processId)
      $stopped[[string] $processId] = $true
    }
    Remove-Item -LiteralPath (Join-Path $logDirectoryPath "$($service.Name).pid") -Force -ErrorAction SilentlyContinue
  }
  if ($stopped.Count -gt 0) { Start-Sleep -Milliseconds 300 }
  Write-Output "$($stopped.Count) processo(s) SnapFlow anterior(es) encerrado(s)."
} catch {
  Write-Error "Nao foi possivel encerrar os processos anteriores: $($_.Exception.Message)"
  exit 1
}
