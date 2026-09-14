const assert = require('node:assert/strict');
const { performance } = require('node:perf_hooks');
const net = require('node:net');
const test = require('node:test');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');

test('startup command cannot wait forever on a hung child', async () => {
  const { runCommand } = await import('../../scripts/startup-command.mjs');
  const start = performance.now();
  const result = await runCommand(process.execPath, ['-e', 'setInterval(() => {}, 1000)'], { timeoutMs: 150 });
  assert.equal(result.timedOut, true);
  assert.ok(performance.now() - start < 8000);
});

test('command failures and missing executables return nonzero without leaking arguments', async () => {
  const { runCommand } = await import('../../scripts/startup-command.mjs');
  const missing = await runCommand('snapflow-missing-command-test', [], { timeoutMs: 1000 });
  assert.equal(missing.errorCode, 'ENOENT');
  const failed = await runCommand(process.execPath, ['-e', 'console.error("failure"); process.exit(4)']);
  assert.equal(failed.code, 4);
  assert.match(failed.stderr, /failure/);
});

test('Windows timeouts stop the spawned command tree instead of leaving a background child', { skip: process.platform !== 'win32' }, async () => {
  const { runCommand } = await import('../../scripts/startup-command.mjs');
  const result = await runCommand(process.execPath, ['-e',
    'const {spawn}=require("node:child_process"); const child=spawn(process.execPath,["-e","setInterval(()=>{},1000)"],{stdio:"ignore",windowsHide:true}); console.log(child.pid); setInterval(()=>{},1000);'],
  { timeoutMs: 500 });
  assert.equal(result.timedOut, true);
  const childPid = Number(result.stdout.trim());
  assert.ok(Number.isInteger(childPid) && childPid > 0);
  try {
    assert.equal(result.cleanupError, undefined);
    assert.throws(() => process.kill(childPid, 0), { code: 'ESRCH' });
  } finally {
    try { process.kill(childPid); } catch (error) { assert.equal(error.code, 'ESRCH'); }
  }
});

test('retry deadline accounts for time spent inside probes and reports progress', async () => {
  const { waitUntil } = await import('../../scripts/startup-command.mjs');
  let clock = 0;
  const logs = [];
  await assert.rejects(waitUntil('PostgreSQL', async () => {
    clock += 30;
    return { ready: false, detail: 'recuperando' };
  }, { now: () => clock, pause: async ms => { clock += ms; }, timeoutMs: 100, delayMs: 10, log: text => logs.push(text) }), /tempo limite.*recuperando/);
  assert.equal(clock, 110);
  assert.equal(logs.length, 3);
});

test('permanent database errors fail immediately with actionable details', async () => {
  const { databaseFailure, redact } = await import('../../scripts/database-startup-config.mjs');
  const { waitUntil } = await import('../../scripts/startup-command.mjs');
  for (const code of ['28P01', '28000', '3D000', 'ENOTFOUND']) {
    const failure = databaseFailure({ code, message: 'private password' });
    assert.equal(failure.fatal, true);
    await assert.rejects(waitUntil('DB', async () => failure), new RegExp(failure.detail.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
    assert.doesNotMatch(failure.detail, /private password/);
  }
  assert.equal(databaseFailure({ code: '57P03' }).fatal, undefined);
  assert.equal(redact('postgres://alice:secret@localhost/db secret', ['secret']), '[DATABASE_URL] [oculto]');
});

function settings(overrides = {}) {
  return { root: process.cwd(), mode: 'docker', local: true, target: '127.0.0.1:55432',
    databaseUrl: 'postgres://user:secret@127.0.0.1:55432/snapflow', env: {}, ...overrides };
}

test('a ready database is reused without Docker/service changes and migrations run once', async () => {
  const { startDatabase } = await import('../../scripts/start-database.mjs');
  const calls = [];
  const deps = { log() {}, probe: async () => ({ ready: true }), run: async (command, args) => {
    calls.push(args); return { code: 0 };
  } };
  await startDatabase(settings(), deps);
  assert.equal(calls.length, 1);
  assert.match(calls[0][0], /migrate\.js$/);
  calls.length = 0;
  await startDatabase(settings({ skipMigrations: true }), deps);
  assert.equal(calls.length, 0);
});

test('cold Docker startup waits for engine, then authenticated database, before migrations', async () => {
  const { startDatabase } = await import('../../scripts/start-database.mjs');
  const commands = [];
  const waits = [];
  let engine = 0;
  let probes = 0;
  await startDatabase(settings(), {
    log() {},
    probe: async () => ({ ready: ++probes > 1 }),
    run: async (command, args, options) => {
      assert.ok(options.timeoutMs > 0);
      commands.push(args);
      if (args[0] === 'info') return { code: ++engine > 1 ? 0 : 1 };
      return { code: 0 };
    },
    wait: async (label, probe) => { waits.push(label); assert.equal((await probe(10000)).ready, true); },
  });
  assert.deepEqual(waits, ['Docker Desktop', 'PostgreSQL']);
  assert.ok(commands.some(args => args.includes('up') && args.includes('postgres')));
  assert.match(commands.at(-1)[0], /migrate\.js$/);
  assert.ok(commands.every(args => !args.includes('down') && !args.includes('--volumes')));
});

test('unreachable database yields container/port diagnostics and never reaches migration', async () => {
  const { startDatabase } = await import('../../scripts/start-database.mjs');
  const commands = [];
  const logs = [];
  await assert.rejects(startDatabase(settings(), {
    log: text => logs.push(text), probe: async () => ({ ready: false }),
    run: async (command, args) => { commands.push(args); return { code: 0, stdout: 'container running' }; },
    wait: async () => { throw new Error('PostgreSQL: tempo limite atingido'); },
  }), /tempo limite/);
  assert.ok(commands.some(args => args.includes('port')));
  assert.ok(commands.some(args => args.includes('logs')));
  assert.ok(commands.every(args => !args[0].endsWith('migrate.js')));
  assert.match(logs.join('\n'), /55432/);
});

test('native service startup precedes SQL readiness; permission failures stop startup', async () => {
  const { startDatabase } = await import('../../scripts/start-database.mjs');
  for (const exitCode of [0, 1]) {
    let queriedAgain = false;
    const attempt = startDatabase(settings({ mode: 'native', skipMigrations: true }), {
      log() {}, probe: async () => ({ ready: false }),
      run: async (command, args) => { assert.match(args.at(-1), /start-native-postgres\.ps1$/); return { code: exitCode }; },
      wait: async () => { queriedAgain = true; },
    });
    if (exitCode) await assert.rejects(attempt, /Servico PostgreSQL/);
    else await attempt;
    assert.equal(queriedAgain, exitCode === 0);
  }
});

test('timed-out migrations propagate failure instead of reporting the database ready for the app', async () => {
  const { startDatabase } = await import('../../scripts/start-database.mjs');
  const logs = [];
  await assert.rejects(startDatabase(settings({ mode: 'native' }), {
    log: text => logs.push(text), probe: async () => ({ ready: true }),
    run: async () => ({ code: 1, timedOut: true }),
  }), /Migracoes PostgreSQL.*tempo limite/);
  assert.ok(!logs.some(text => text.includes('Banco pronto para iniciar')));
});

test('database URL controls the probe and Docker port despite stale inherited settings', async () => {
  const { loadDatabaseSettings } = await import('../../scripts/database-startup-config.mjs');
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'snapflow-db-config-'));
  try {
    await fs.mkdir(path.join(dir, 'backend'));
    await fs.writeFile(path.join(dir, '.env'), 'POSTGRES_PORT=55432\nSNAPFLOW_DB_MODE=docker\nSNAPFLOW_ALLOWED_HOSTS=example.ts.net\n');
    await fs.writeFile(path.join(dir, 'backend/.env.local'), 'DATABASE_URL="postgres://user:p%23ss@127.0.0.1:55499/photos"\n');
    const result = loadDatabaseSettings(dir, { POSTGRES_PORT: '1111', DATABASE_URL: 'postgres://old:old@localhost:2222/old' });
    assert.equal(result.target, '127.0.0.1:55499');
    assert.equal(result.env.POSTGRES_PORT, '55499');
    assert.equal(result.env.POSTGRES_PASSWORD, 'p#ss');
    assert.equal(result.env.SNAPFLOW_ALLOWED_HOSTS, 'example.ts.net');
    assert.equal(result.env.DATABASE_URL, result.databaseUrl);
    await fs.writeFile(path.join(dir, 'backend/.env.local'), 'DATABASE_URL=invalid\n');
    assert.throws(() => loadDatabaseSettings(dir, {}), /DATABASE_URL/);
  } finally { await fs.rm(dir, { recursive: true, force: true }); }
});

test('an open TCP socket without a PostgreSQL handshake is not ready', async () => {
  const { probeDatabase } = await import('../../scripts/database-startup-config.mjs');
  const sockets = new Set();
  const server = net.createServer(socket => { sockets.add(socket); socket.on('close', () => sockets.delete(socket)); });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  try {
    const start = performance.now();
    const result = await probeDatabase(`postgres://test:test@127.0.0.1:${server.address().port}/test`, 150);
    assert.equal(result.ready, false);
    assert.ok(performance.now() - start < 3000);
  } finally {
    sockets.forEach(socket => socket.destroy());
    await new Promise(resolve => server.close(resolve));
  }
});

test('environment synchronization accepts quoted URLs and preserves passwords containing hashes', async () => {
  const { runCommand } = await import('../../scripts/startup-command.mjs');
  const { readEnv } = await import('../../scripts/database-startup-config.mjs');
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'snapflow-db-sync-'));
  try {
    await fs.mkdir(path.join(dir, 'backend'));
    await fs.writeFile(path.join(dir, '.env'), 'SNAPFLOW_ALLOWED_HOSTS=example.ts.net\nCUSTOM_LABEL="preserve # text"\n');
    await fs.writeFile(path.join(dir, 'backend/.env.local'), 'DATABASE_URL="postgres://user:p%23ss%24word@127.0.0.1:55499/photos"\n');
    const script = path.resolve(__dirname, '../../scripts/sync-docker-env.mjs');
    for (let iteration = 0; iteration < 2; iteration += 1) {
      const result = await runCommand(process.execPath, [script], { cwd: dir, timeoutMs: 3000 });
      assert.equal(result.code, 0);
      assert.doesNotMatch(result.stdout, /p#ss/);
      const values = readEnv(path.join(dir, '.env'));
      assert.equal(values.POSTGRES_PORT, '55499');
      assert.equal(values.POSTGRES_PASSWORD, 'p#ss$word');
      assert.equal(values.SNAPFLOW_ALLOWED_HOSTS, 'example.ts.net');
      assert.equal(values.CUSTOM_LABEL, 'preserve # text');
    }
  } finally { await fs.rm(dir, { recursive: true, force: true }); }
});
