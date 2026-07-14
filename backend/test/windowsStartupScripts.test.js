const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const root = path.join(__dirname, '..', '..');

function read(file) {
  return fs.readFileSync(path.join(root, file), 'utf8');
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
    'start "APP FOTOGRAFIA - SERVIDOR"',
    'wait-api',
    'start "APP FOTOGRAFIA - PAINEL"',
    'wait-panel',
  ]);
  assert.match(script, /SNAPFLOW_SKIP_STARTUP_MIGRATIONS=1/i);
  assert.match(script, /BACKEND_API_PORT/i);
  assert.match(script, /SNAPFLOW_API_PORT=%SNAPFLOW_API_PORT%/i);
  assert.match(script, /--strictPort/i);
  assert.doesNotMatch(script, /timeout \/t 2/i);
});

test('standalone launchers enforce API identity and strict port ownership', () => {
  const server = read('INICIAR_SERVIDOR.bat');
  const panel = read('INICIAR_PAINEL.bat');

  assertOrdered(server, ['assert-port API', 'INICIAR_BANCO.bat', 'SNAPFLOW_SKIP_STARTUP_MIGRATIONS', 'npm.cmd start']);
  assertOrdered(panel, ['wait-api', 'assert-port painel', 'npm.cmd run dev']);
  assert.match(panel, /SNAPFLOW_API_PORT/i);
  assert.match(panel, /BACKEND_API_PORT/i);
  assert.match(panel, /--strictPort/i);
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
