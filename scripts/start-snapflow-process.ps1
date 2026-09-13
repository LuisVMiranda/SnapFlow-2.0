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
  $pidPath = Join-Path $resolvedLogDirectory "$Name.pid"
  $process = Start-Process -FilePath 'cmd.exe' -ArgumentList @('/d', '/c', $Command) `
    -WorkingDirectory $resolvedWorkingDirectory -WindowStyle Hidden `
    -RedirectStandardOutput $stdoutPath -RedirectStandardError $stderrPath -PassThru
  Set-Content -LiteralPath $pidPath -Value $process.Id -NoNewline -Encoding ascii

  Write-Output "$Name iniciado em segundo plano (PID $($process.Id))."
  Write-Output "Log principal: $stdoutPath"
  Write-Output "Log de erros: $stderrPath"
} catch {
  Write-Error "Nao foi possivel iniciar $Name em segundo plano: $($_.Exception.Message)"
  exit 1
}
