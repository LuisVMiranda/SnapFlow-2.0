$ErrorActionPreference = 'Stop'

function Read-DotEnv([string] $path) {
  $values = @{}
  if (-not (Test-Path -LiteralPath $path)) { return $values }
  foreach ($line in Get-Content -LiteralPath $path) {
    if ($line -match '^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$') {
      $values[$matches[1]] = $matches[2].Trim().Trim('"').Trim("'")
    }
  }
  return $values
}

function Resolve-Setting([string] $name, [hashtable] $rootValues, [hashtable] $backendValues, [string] $fallback) {
  $environmentValue = [Environment]::GetEnvironmentVariable($name)
  if ($environmentValue) { return $environmentValue }
  if ($rootValues.ContainsKey($name) -and $rootValues[$name]) { return $rootValues[$name] }
  if ($backendValues.ContainsKey($name) -and $backendValues[$name]) { return $backendValues[$name] }
  return $fallback
}

try {
  Set-Location -LiteralPath (Split-Path -Parent $PSScriptRoot)
  $rootEnv = Read-DotEnv (Join-Path (Get-Location) '.env')
  $backendEnv = Read-DotEnv (Join-Path (Get-Location) 'backend\.env.local')
  $apiPort = Resolve-Setting 'SNAPFLOW_API_PORT' $rootEnv $backendEnv '3000'
  if ($backendEnv.ContainsKey('PORT') -and $backendEnv.PORT) { $apiPort = $backendEnv.PORT }
  $panelPort = Resolve-Setting 'SNAPFLOW_DEV_PORT' $rootEnv $backendEnv '5173'
  $websitePort = Resolve-Setting 'SNAPFLOW_WEBSITE_PORT' $rootEnv $backendEnv '5174'
  node scripts/snapflow-startup.mjs assert-distinct $apiPort $panelPort $websitePort
  if ($LASTEXITCODE) { throw 'API, painel e website precisam usar portas diferentes.' }
  node scripts/snapflow-startup.mjs wait-api "http://127.0.0.1:$apiPort/api/health" 1
  if ($LASTEXITCODE) { throw 'Inicie a API antes de publicar.' }
  node scripts/snapflow-startup.mjs wait-panel "http://127.0.0.1:$panelPort/" 1
  if ($LASTEXITCODE) { throw 'Inicie o painel antes de publicar.' }
  node scripts/snapflow-startup.mjs wait-website "http://127.0.0.1:$websitePort/" 1
  if ($LASTEXITCODE) { throw 'Inicie o website antes de publicar.' }
  tailscale up --timeout=20s
  if ($LASTEXITCODE) { throw 'Conecte este computador ao Tailscale.' }
  $siteTailnetStatus = tailscale status --json | ConvertFrom-Json
  if ($siteTailnetStatus.Self.DNSName.TrimEnd('.') -ne 'desktop-luis.tail2104cf.ts.net') {
    throw 'Hostname diferente do configurado. Revise as URLs públicas antes de continuar.'
  }
  Write-Output 'Publicando website em HTTPS 443 e painel/galerias em HTTPS 8443. O acesso será público.'
  tailscale funnel --bg --https=443 "http://127.0.0.1:$websitePort"
  if ($LASTEXITCODE) { throw 'Ative Funnel pelo link exibido pelo Tailscale e tente novamente.' }
  tailscale funnel --bg --https=8443 "http://127.0.0.1:$panelPort"
  if ($LASTEXITCODE) { throw 'Não foi possível publicar painel/galerias.' }
  tailscale funnel status
  if ($LASTEXITCODE) { throw 'Não foi possível verificar os endereços públicos.' }
} catch {
  Write-Error $_
  exit 1
}
