import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { loadDatabaseSettings, probeDatabase, redact } from './database-startup-config.mjs';
import { runCommand, waitUntil } from './startup-command.mjs';
import { prepareDockerDatabase } from './docker-database.mjs';

const docker = process.platform === 'win32' ? 'docker.exe' : 'docker';

function createOperations(settings, overrides) {
  const log = overrides.log || console.log;
  const run = overrides.run || runCommand;
  const execute = (command, args, timeoutMs = 10000) => run(command, args, {
    cwd: settings.root, env: settings.env, timeoutMs,
    onProgress: elapsed => log(`Operacao em andamento: ${Math.floor(elapsed / 1000)}/${Math.ceil(timeoutMs / 1000)}s...`),
  });
  const compose = (args, timeoutMs = 15000) => execute(process.execPath,
    [path.join(settings.root, 'scripts/run-docker-compose.mjs'),
      ...(settings.composeProject ? ['--project-name', settings.composeProject] : []), ...args], timeoutMs);
  return { log, execute, compose, probe: overrides.probe || probeDatabase, wait: overrides.wait || waitUntil };
}

function requireSuccess(result, label, log) {
  if (result.code === 0 && !result.timedOut) return;
  if (result.stdout) log(result.stdout);
  if (result.stderr) log(result.stderr);
  const detail = result.timedOut ? 'comando excedeu o tempo limite' : 'comando falhou';
  throw new Error(`${label}: ${detail}. Confira logs\\database-startup.log.`);
}

async function ensureDocker(ops) {
  const first = await ops.execute(docker, ['info', '--format', '{{.ServerVersion}}'], 8000);
  if (first.code === 0) return;
  if (first.errorCode === 'ENOENT') throw new Error('Docker nao encontrado. Instale o Docker Desktop ou confira SNAPFLOW_DB_MODE.');
  ops.log('Docker ainda nao esta pronto. Aguardando o engine por ate 120s...');
  if (process.platform === 'win32') {
    const desktop = await ops.execute('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command',
      '$app=Join-Path $env:ProgramFiles "Docker\\Docker\\Docker Desktop.exe"; if(Test-Path -LiteralPath $app){Start-Process -FilePath $app -WindowStyle Hidden}else{exit 1}'], 10000);
    if (desktop.code !== 0) ops.log('Abra o Docker Desktop manualmente; continuando a verificacao com tempo limitado.');
  }
  await ops.wait('Docker Desktop', async remaining => {
    const result = await ops.execute(docker, ['info', '--format', '{{.ServerVersion}}'], Math.min(8000, remaining));
    return { ready: result.code === 0, detail: 'engine indisponivel; confira Docker Desktop e WSL2' };
  }, { timeoutMs: 120000, log: ops.log });
}

async function startDocker(ops, settings) {
  await ensureDocker(ops);
  ops.log('Conferindo container PostgreSQL e publicacao da porta (limite: 180s)...');
  return prepareDockerDatabase(ops, settings);
}

async function waitForDatabase(ops, settings, managed) {
  let last;
  const wait = () => ops.wait('PostgreSQL', async remaining => {
    last = await ops.probe(settings.databaseUrl, Math.min(3000, Math.max(1, Math.floor(remaining / 2))));
    return last;
  }, { timeoutMs: 90000, log: ops.log });
  try { await wait(); }
  catch (error) {
    if (last?.fatal || !managed || !await managed.repair()) throw error;
    ops.log('Porta recriada. Verificando novamente autenticacao e consulta por ate 90s...');
    await wait();
  }
}

async function startNative(ops, settings) {
  if (!settings.local) return;
  ops.log('Verificando o servico PostgreSQL nativo (limite: 45s)...');
  const result = await ops.execute('powershell.exe', ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass',
    '-File', path.join(settings.root, 'scripts/start-native-postgres.ps1')], 45000);
  requireSuccess(result, 'Servico PostgreSQL', ops.log);
  if (result.stdout) ops.log(result.stdout);
}

async function diagnostics(ops, settings) {
  if (settings.mode !== 'docker') return;
  ops.log('Diagnostico Docker: estado, saude e portas publicadas (sem alterar dados)...');
  for (const args of [['ps', '-a', 'postgres'], ['port', 'postgres', '5432'], ['logs', '--no-color', '--tail', '35', 'postgres']]) {
    const result = await ops.compose(args, 6000);
    const output = [result.stdout, result.stderr].filter(Boolean).join('\n');
    if (output) ops.log(output.replace(/^.*(?:statement:|password\s*=).*$/gim, '[linha de diagnostico omitida]'));
    if (result.timedOut) ops.log('Uma consulta de diagnostico Docker excedeu 6s.');
  }
  ops.log(`Destino esperado: ${settings.target}. Confira se a porta publicada coincide com DATABASE_URL.`);
  ops.log('Se o engine ou a publicacao da porta travou apos reiniciar o Windows, reinicie o Docker Desktop e tente novamente.');
  ops.log('Nao exclua volumes nem use docker compose down -v: as fotos e registros existentes devem ser preservados.');
}

export async function startDatabase(settings, overrides = {}) {
  const ops = createOperations(settings, overrides);
  ops.log(`Verificando PostgreSQL em ${settings.target} (modo ${settings.mode})...`);
  try {
    const initial = await ops.probe(settings.databaseUrl);
    if (initial.fatal) throw new Error(initial.detail);
    if (!initial.ready) {
      let managed;
      if (settings.mode === 'docker') managed = await startDocker(ops, settings);
      else await startNative(ops, settings);
      ops.log(`Aguardando autenticacao e consulta PostgreSQL em ${settings.target} por ate 90s...`);
      await waitForDatabase(ops, settings, managed);
    }
    ops.log('PostgreSQL pronto: autenticacao e SELECT 1 confirmados.');
    if (settings.skipMigrations) return;
    ops.log('Aplicando migracoes do banco (limite: 120s, incluindo espera por bloqueios)...');
    const migrations = await ops.execute(process.execPath, [path.join(settings.root, 'backend/scripts/migrate.js')], 120000);
    requireSuccess(migrations, 'Migracoes PostgreSQL', ops.log);
    if (migrations.stdout) ops.log(migrations.stdout);
    ops.log('Migracoes em dia. Banco pronto para iniciar o SnapFlow.');
  } catch (error) {
    ops.log(`ERRO: ${error.message}`);
    await diagnostics(ops, settings).catch(() => ops.log('Nao foi possivel coletar o diagnostico Docker.'));
    throw error;
  }
}

function loggerFor(settings) {
  const dir = path.join(settings.root, 'logs');
  fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, 'database-startup.log');
  // Keep one previous run; do not accumulate unbounded diagnostics.
  if (fs.existsSync(file)) fs.copyFileSync(file, `${file}.previous`);
  fs.writeFileSync(file, `SnapFlow database startup ${new Date().toISOString()}\n`);
  return message => {
    const safe = redact(message, settings.secrets);
    console.log(safe);
    try { fs.appendFileSync(file, `${safe}\n`); }
    catch { console.error('Nao foi possivel gravar logs\\database-startup.log. Confira o espaco e as permissoes.'); }
  };
}

async function main() {
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
  const settings = loadDatabaseSettings(root);
  settings.env.SNAPFLOW_POSTGRES_SERVICE = settings.service;
  settings.skipMigrations = process.argv.includes('--sem-migracoes');
  const log = loggerFor(settings);
  if (settings.mode === 'docker') {
    const sync = await runCommand(process.execPath, [path.join(root, 'scripts/sync-docker-env.mjs')],
      { cwd: root, env: settings.env, timeoutMs: 10000 });
    requireSuccess(sync, 'Sincronizacao da configuracao Docker', log);
  }
  await startDatabase(settings, { log });
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  main().catch(error => {
    console.error(`ERRO: ${redact(error.message)}`);
    console.error('Nao foi possivel preparar o banco. Consulte logs\\database-startup.log e tente novamente apos corrigir a causa.');
    process.exitCode = 1;
  });
}
