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

function Normalize-DnsName([string] $value) {
  $normalized = ([string] $value).Trim().TrimEnd('.').ToLowerInvariant()
  if ($normalized -notmatch '^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)+$' -or $normalized -notmatch '\.ts\.net$') {
    throw 'O Tailscale não retornou um hostname MagicDNS .ts.net válido.'
  }
  return $normalized
}

function Get-TailscaleDnsName() {
  $status = tailscale status --json | ConvertFrom-Json
  if ($LASTEXITCODE -ne 0 -or -not $status.Self.DNSName) {
    throw 'Não foi possível descobrir o hostname do Tailscale. Conecte este computador ao Tailscale.'
  }
  return Normalize-DnsName $status.Self.DNSName
}

function Merge-AllowedHosts([string] $current, [string] $hostname) {
  $hosts = @($current -split ',' | ForEach-Object { $_.Trim() } | Where-Object { $_ })
  if ($hosts -notcontains $hostname) { $hosts += $hostname }
  return $hosts -join ','
}

function Set-DotEnvValue([string] $path, [hashtable] $updates) {
  $lines = if (Test-Path -LiteralPath $path) { @(Get-Content -LiteralPath $path) } else { @() }
  $written = @{}
  $result = [System.Collections.Generic.List[string]]::new()
  foreach ($line in $lines) {
    if ($line -match '^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=') {
      $key = $matches[1]
      if ($updates.ContainsKey($key)) {
        [void] $result.Add("$key=$($updates[$key])")
        $written[$key] = $true
        continue
      }
    }
    [void] $result.Add($line)
  }
  foreach ($key in $updates.Keys) {
    if (-not $written.ContainsKey($key)) { [void] $result.Add("$key=$($updates[$key])") }
  }
  $parent = Split-Path -Parent $path
  if (-not (Test-Path -LiteralPath $parent)) { throw "Diretório de configuração ausente: $parent" }
  [IO.File]::WriteAllLines($path, $result.ToArray(), [Text.UTF8Encoding]::new($false))
}

function Configure-FunnelRoute([int] $httpsPort, [int] $localPort) {
  $target = "http://127.0.0.1:$localPort"
  Write-Output "Publicando HTTPS $httpsPort -> $target"
  tailscale funnel --bg "--https=$httpsPort" $target
  if ($LASTEXITCODE) { throw "Não foi possível publicar a porta HTTPS $httpsPort." }
}

function Assert-FunnelRoute([string] $status, [string] $hostname, [int] $httpsPort, [int] $localPort) {
  $publicUrl = "https://$hostname"
  if ($httpsPort -ne 443) { $publicUrl = "$publicUrl`:$httpsPort" }
  $lines = $status -split '\r?\n'
  $headerPattern = '^' + [regex]::Escape($publicUrl) + '\s+\(Funnel on\)'
  $headerIndex = -1
  for ($index = 0; $index -lt $lines.Count; $index++) {
    if ($lines[$index] -match $headerPattern) { $headerIndex = $index; break }
  }
  if ($headerIndex -lt 0) { throw "A rota pública não foi encontrada: $publicUrl" }
  $end = $lines.Count - 1
  for ($lineIndex = $headerIndex + 1; $lineIndex -lt $lines.Count; $lineIndex++) {
    if ($lines[$lineIndex] -match '^https://.+\s+\(Funnel on\)') { $end = $lineIndex - 1; break }
  }
  $routeBlock = $lines[$headerIndex..$end] -join "`n"
  if ($routeBlock -notmatch [regex]::Escape("127.0.0.1:$localPort")) {
    throw "A rota $publicUrl não aponta para 127.0.0.1:$localPort."
  }
}

try {
  $root = (Resolve-Path -LiteralPath (Join-Path $PSScriptRoot '..')).Path
  Set-Location -LiteralPath $root
  $rootEnvPath = Join-Path $root '.env'
  $backendEnvPath = Join-Path $root 'backend\.env.local'
  $rootEnv = Read-DotEnv $rootEnvPath
  $backendEnv = Read-DotEnv $backendEnvPath
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
  $hostname = Get-TailscaleDnsName
  $websiteUrl = "https://$hostname"
  $galleryUrl = "$websiteUrl`:8443"

  Configure-FunnelRoute 443 $websitePort
  Configure-FunnelRoute 8443 $panelPort
  $funnelStatus = tailscale funnel status 2>&1 | Out-String
  if ($LASTEXITCODE) { throw 'Não foi possível verificar os endereços públicos.' }
  Assert-FunnelRoute $funnelStatus $hostname 443 $websitePort
  Assert-FunnelRoute $funnelStatus $hostname 8443 $panelPort

  Set-DotEnvValue $rootEnvPath @{
    PUBLIC_WEBSITE_URL = $websiteUrl
    SNAPFLOW_ALLOWED_HOSTS = Merge-AllowedHosts $rootEnv['SNAPFLOW_ALLOWED_HOSTS'] $hostname
  }
  Set-DotEnvValue $backendEnvPath @{
    PUBLIC_WEBSITE_URL = $websiteUrl
    PUBLIC_BASE_URL = $galleryUrl
  }
  Write-Output "Website público: $websiteUrl"
  Write-Output "Painel e galerias: $galleryUrl"
  Write-Output 'URLs salvas em .env e backend\.env.local. Reinicie o SnapFlow para carregar a nova configuração.'
  Write-Output 'Se Credenciais > URL pública estiver salva, atualize-a também para o endereço do painel acima.'
} catch {
  Write-Error $_
  exit 1
}
