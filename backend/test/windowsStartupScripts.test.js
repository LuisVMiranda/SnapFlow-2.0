const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const root = path.join(__dirname, '..', '..');

function read(file) {
  return fs.readFileSync(path.join(root, file), 'utf8');
}

function assertCrLfOnly(file) {
  const content = read(file);
  const withoutCrLf = content.replace(/\r\n/g, '');
  assert.doesNotMatch(withoutCrLf, /[\r\n]/, `${file} deve usar somente finais de linha CRLF`);
}

function assertOrdered(content, fragments) {
  let previousIndex = -1;
  for (const fragment of fragments) {
    const index = content.indexOf(fragment);
    assert.ok(index > previousIndex, `Esperava encontrar em ordem: ${fragment}`);
    previousIndex = index;
  }
}

test('INICIAR_TUDO waits for each SnapFlow branch instead of sleeping for a fixed time', () => {
  const script = read('INICIAR_TUDO.bat');

  assertOrdered(script, [
    'assert-port API',
    'assert-port painel',
    'INICIAR_BANCO.bat',
    'start-snapflow-process.ps1" -Name api',
    'wait-api',
    'npm.cmd run build:panel',
    'start-snapflow-process.ps1" -Name panel',
    'wait-panel',
  ]);
  assert.match(script, /SNAPFLOW_SKIP_STARTUP_MIGRATIONS=1/i);
  assert.match(script, /BACKEND_API_PORT/i);
  assert.match(script, /SNAPFLOW_API_PORT=%SNAPFLOW_API_PORT%/i);
  assert.match(script, /npm\.cmd run serve:panel/i);
  assert.doesNotMatch(script, /npm\.cmd run dev -- --host/i);
  assert.match(script, /logs\\api\.error\.log/i);
  assert.match(script, /logs\\panel\.error\.log/i);
  assert.match(script, /logs\\website\.error\.log/i);
  assert.doesNotMatch(script, /-WorkingDirectory "%~dp0"/i);
  assert.match(script, /-WorkingDirectory "%~dp0\."/i);
  assert.doesNotMatch(script, /cmd \/k/i);
  assert.doesNotMatch(script, /timeout \/t 2/i);
});

test('background process runner hides child terminals and captures logs', () => {
  const runner = read(path.join('scripts', 'start-snapflow-process.ps1'));

  assert.match(runner, /ValidateSet\('api', 'panel', 'website'\)/i);
  assert.match(runner, /Start-Process/i);
  assert.match(runner, /-WindowStyle Hidden/i);
  assert.match(runner, /-RedirectStandardOutput/i);
  assert.match(runner, /-RedirectStandardError/i);
  assert.match(runner, /\$Name\.pid/i);
});

test('INICIAR_TUDO force-stops identified SnapFlow owners before checking ports', () => {
  const script = read('INICIAR_TUDO.bat');
  const stopper = read(path.join('scripts', 'stop-snapflow-processes.ps1'));

  assertOrdered(script, [
    'assert-distinct',
    'stop-snapflow-processes.ps1',
    'assert-port API',
  ]);
  assert.match(script, /-ApiPort "%SNAPFLOW_API_PORT%"/i);
  assert.match(script, /-PanelPort "%SNAPFLOW_DEV_PORT%"/i);
  assert.match(script, /-WebsitePort "%SNAPFLOW_WEBSITE_PORT%"/i);
  assert.match(stopper, /Get-NetTCPConnection/i);
  assert.match(stopper, /netstat\.exe/i);
  assert.match(stopper, /Get-Process -Id/i);
  assert.match(stopper, /taskkill\.exe/i);
  assert.match(stopper, /\/T \/F/i);
  assert.match(stopper, /server\.js/i);
  assert.match(stopper, /panel-server\.mjs|serve:panel/i);
  assert.match(stopper, /vite\.website\.config\.js/i);
  assert.match(stopper, /Processo SnapFlow nao identificado|processo.*nao identificado/i);
});

test('standalone launchers enforce API identity and strict port ownership', () => {
  const server = read('INICIAR_SERVIDOR.bat');
  const panel = read('INICIAR_PAINEL.bat');

  assertOrdered(server, ['assert-port API', 'INICIAR_BANCO.bat', 'SNAPFLOW_SKIP_STARTUP_MIGRATIONS', 'npm.cmd start']);
  assertOrdered(panel, ['wait-api', 'assert-port painel', 'npm.cmd run build:panel', 'npm.cmd run serve:panel']);
  assert.match(panel, /SNAPFLOW_API_PORT/i);
  assert.match(panel, /BACKEND_API_PORT/i);
  assert.doesNotMatch(panel, /npm\.cmd run dev/i);
});

test('installers and database verification preserve the configured API port and startup probe', () => {
  const dockerInstaller = read('INSTALAR_SNAPFLOW.bat');
  const nativeInstaller = read('INSTALAR_SNAPFLOW_SEM_DOCKER.bat');
  const databaseLauncher = read('INICIAR_BANCO.bat');
  const dockerEnvSync = read(path.join('scripts', 'sync-docker-env.mjs'));

  assert.match(dockerInstaller, /SNAPFLOW_API_PORT='\+\$env:PORT/i);
  assert.match(nativeInstaller, /SNAPFLOW_API_PORT='\+\$env:PORT/i);
  assert.match(databaseLauncher, /node --check scripts\\snapflow-startup\.mjs/i);
  assert.match(dockerEnvSync, /'SNAPFLOW_API_PORT'/i);
});

test('website Funnel launcher resolves configured API, panel and website ports', () => {
  const funnel = read(path.join('scripts', 'configure-website-funnel.ps1'));
  assert.match(funnel, /SNAPFLOW_API_PORT/);
  assert.match(funnel, /SNAPFLOW_DEV_PORT/);
  assert.match(funnel, /SNAPFLOW_WEBSITE_PORT/);
  assert.match(funnel, /127\.0\.0\.1:\$websitePort/);
  assert.match(funnel, /127\.0\.0\.1:\$panelPort/);
  assert.match(funnel, /wait-api .* 30 1000/);
  assert.match(funnel, /wait-panel .* 30 1000/);
  assert.match(funnel, /wait-website .* 30 1000/);
  assert.match(funnel, /Get-TailscaleDnsName/);
  assert.match(funnel, /tailscale status --json/);
  assert.match(funnel, /Assert-FunnelRoute/);
  assert.match(funnel, /Configure-FunnelRoute 443 \$websitePort/);
  assert.match(funnel, /Configure-FunnelRoute 8443 \$panelPort/);
  assert.match(funnel, /PUBLIC_WEBSITE_URL/);
  assert.match(funnel, /PUBLIC_BASE_URL/);
  assert.match(funnel, /SNAPFLOW_ALLOWED_HOSTS/);
  assert.doesNotMatch(funnel, /desktop-luis\.tail2104cf\.ts\.net/);
  assert.doesNotMatch(funnel, /127\.0\.0\.1:5174/);
  assert.doesNotMatch(funnel, /127\.0\.0\.1:5173/);
});

test('Windows command launchers use CRLF line endings consistently', () => {
  const launchers = fs.readdirSync(root).filter((file) => file.endsWith('.bat'));
  for (const launcher of launchers) assertCrLfOnly(launcher);
});
