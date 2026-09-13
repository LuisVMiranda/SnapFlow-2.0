param(
  [Parameter(Mandatory = $true)]
  [ValidateSet('api', 'panel', 'website')]
  [string] $Name,
  [Parameter(Mandatory = $true)]
  [string] $WorkingDirectory,
  [Parameter(Mandatory = $true)]
  [string] $Command,
  [string] $LogDirectory = 'logs'
)

$ErrorActionPreference = 'Stop'

try {
  $resolvedWorkingDirectory = (Resolve-Path -LiteralPath $WorkingDirectory).Path
  $root = (Resolve-Path -LiteralPath (Join-Path $PSScriptRoot '..')).Path
  $resolvedLogDirectory = Join-Path $root $LogDirectory
  New-Item -ItemType Directory -Force -Path $resolvedLogDirectory | Out-Null

  $stdoutPath = Join-Path $resolvedLogDirectory "$Name.log"
  $stderrPath = Join-Path $resolvedLogDirectory "$Name.error.log"
  $process = Start-Process -FilePath 'cmd.exe' -ArgumentList @('/d', '/c', $Command) `
    -WorkingDirectory $resolvedWorkingDirectory -WindowStyle Hidden `
    -RedirectStandardOutput $stdoutPath -RedirectStandardError $stderrPath -PassThru

  Write-Output "$Name iniciado em segundo plano (PID $($process.Id))."
  Write-Output "Saída: $stdoutPath"
  Write-Output "Erros: $stderrPath"
} catch {
  Write-Error "Não foi possível iniciar $Name em segundo plano: $($_.Exception.Message)"
  exit 1
}
