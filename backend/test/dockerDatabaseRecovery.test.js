const assert = require('node:assert/strict');
const path = require('node:path');
const test = require('node:test');

function container(overrides = {}) {
  return { id: 'owned-postgres-id', name: '/snapflow-postgres', image: 'postgres:16-alpine',
    project: 'snapflow-20', service: 'postgres', status: 'running', health: 'healthy',
    mounts: [{ Type: 'volume', Name: 'snapflow-20_snapflow_postgres_data', Destination: '/var/lib/postgresql/data' }],
    bindings: { '5432/tcp': [{ HostIp: '127.0.0.1', HostPort: '55432' }] }, ports: {}, ...overrides };
}

function composeConfig() {
  return { services: { postgres: { container_name: 'snapflow-postgres', image: 'postgres:16-alpine',
    ports: [{ host_ip: '127.0.0.1', published: '55432', target: 5432, protocol: 'tcp' }],
    volumes: [{ type: 'volume', source: 'snapflow_postgres_data', target: '/var/lib/postgresql/data' }] } },
  volumes: { snapflow_postgres_data: { name: 'snapflow-20_snapflow_postgres_data' } } };
}

function harness(options = {}) {
  let repaired = false;
  let started = false;
  let probes = 0;
  const commands = [];
  const logs = [];
  const settings = { root: path.resolve(__dirname, '../..'), mode: 'docker', local: true,
    databaseUrl: 'postgres://test:secret@127.0.0.1:55432/test', target: '127.0.0.1:55432', env: {}, skipMigrations: true };
  const deps = {
    log: value => logs.push(value),
    probe: async () => {
      probes += 1;
      if (options.fatalAfterStart && probes > 1) return { fatal: true, detail: 'Credenciais recusadas' };
      return { ready: (repaired || options.normalStartup && probes > 1) && !options.stillBroken };
    },
    wait: async (label, probe) => {
      const result = await probe(90000);
      if (result.fatal) throw new Error(result.detail);
      if (!result.ready) throw new Error(`${label}: tempo limite atingido`);
    },
    run: async (command, args) => {
      commands.push(args);
      if (args[0] === 'context') return { code: 0, stdout: JSON.stringify(options.endpoint || 'npipe:////./pipe/dockerDesktopLinuxEngine') };
      if (args[0] === 'inspect') {
        if (options.inspectError) return { code: 1, stderr: 'permission denied' };
        if (options.firstInstall && !started) return { code: 1, stderr: 'Error: No such container: snapflow-postgres' };
        const value = container(options.container);
        if (options.createdBeforeUp && !started) { value.status = 'created'; value.health = null; }
        if (repaired || options.staleForwarder) value.ports = value.bindings;
        return { code: 0, stdout: JSON.stringify(value) };
      }
      if (args[0] === 'volume') return { code: options.volumeError ? 1 : 0, stdout: JSON.stringify('snapflow-20_snapflow_postgres_data') };
      if (args.includes('config')) return { code: 0, stdout: JSON.stringify(options.config || composeConfig()) };
      if (args.includes('--force-recreate') && options.repairError) return { code: 1, stderr: 'port allocation failed' };
      if (args.includes('up')) started = true;
      if (args.includes('--force-recreate')) repaired = true;
      return { code: 0, stdout: '' };
    },
  };
  return { settings, deps, commands, logs };
}

test('healthy container with no published port is repaired once without replacing its volume', async () => {
  const { startDatabase } = await import('../../scripts/start-database.mjs');
  const h = harness();
  await startDatabase(h.settings, h.deps);
  const repairs = h.commands.filter(args => args.includes('--force-recreate'));
  assert.equal(repairs.length, 1);
  assert.ok(repairs[0].includes('--no-deps'));
  assert.ok(repairs[0].includes('snapflow-20'));
  assert.ok(h.commands.some(args => args[0] === 'volume'));
  assert.ok(h.commands.every(args => !args.some(arg => ['down', 'rm', 'prune', '-V', '--renew-anon-volumes', '--remove-orphans'].includes(arg))));
  assert.match(h.logs.join('\n'), /snapflow-20_snapflow_postgres_data/);
});

test('healthy but unreachable Docker forwarding receives only one bounded repair attempt', async () => {
  const { startDatabase } = await import('../../scripts/start-database.mjs');
  const h = harness({ staleForwarder: true, stillBroken: true });
  await assert.rejects(startDatabase(h.settings, h.deps), /tempo limite/);
  assert.equal(h.commands.filter(args => args.includes('--force-recreate')).length, 1);
});

test('unowned containers, unexpected volumes and remote Docker contexts never get recreated', async () => {
  const { startDatabase } = await import('../../scripts/start-database.mjs');
  for (const options of [
    { container: { service: 'other' } },
    { container: { mounts: [{ Type: 'volume', Name: 'valuable-data', Destination: '/var/lib/postgresql/data' }] } },
    { endpoint: 'ssh://remote-server' }, { endpoint: 'npipe:////remote-server/pipe/docker_engine' }, { inspectError: true },
  ]) {
    const h = harness(options);
    await assert.rejects(startDatabase(h.settings, h.deps));
    assert.equal(h.commands.filter(args => args.includes('up')).length, 0);
  }
});

test('unhealthy PostgreSQL fails with diagnostics instead of recreating its data container', async () => {
  const { startDatabase } = await import('../../scripts/start-database.mjs');
  const h = harness({ container: { health: 'unhealthy' } });
  await assert.rejects(startDatabase(h.settings, h.deps), /unhealthy/);
  assert.equal(h.commands.filter(args => args.includes('--force-recreate')).length, 0);
});

test('normal startup and authentication failures never force-recreate a correctly published container', async () => {
  const { startDatabase } = await import('../../scripts/start-database.mjs');
  for (const options of [{ normalStartup: true }, { fatalAfterStart: true }]) {
    const h = harness({ ...options, staleForwarder: true });
    const attempt = startDatabase(h.settings, h.deps);
    if (options.fatalAfterStart) await assert.rejects(attempt, /Credenciais/);
    else await attempt;
    assert.equal(h.commands.filter(args => args.includes('--force-recreate')).length, 0);
  }
});

test('a renamed checkout retains the existing project and volume identity', async () => {
  const { startDatabase } = await import('../../scripts/start-database.mjs');
  const h = harness();
  h.settings.root = path.resolve('renamed-snapflow-copy');
  h.settings.env.COMPOSE_PROJECT_NAME = 'wrong-project';
  await startDatabase(h.settings, h.deps);
  assert.equal(h.settings.composeProject, 'snapflow-20');
  assert.ok(h.commands.filter(args => args.includes('up')).every(args => args.includes('snapflow-20')));
});

test('incorrect rendered ports or volume names block Compose up before mutation', async () => {
  const { startDatabase } = await import('../../scripts/start-database.mjs');
  const wrongPort = composeConfig();
  wrongPort.services.postgres.ports = [];
  const wrongVolume = composeConfig();
  wrongVolume.volumes.snapflow_postgres_data.name = 'new-empty-volume';
  for (const config of [wrongPort, wrongVolume]) {
    const h = harness({ config });
    await assert.rejects(startDatabase(h.settings, h.deps), /Porta|Volume/);
    assert.equal(h.commands.filter(args => args.includes('up')).length, 0);
  }
});

test('volume inspection errors and failed recreation stop instead of retrying destructively', async () => {
  const { startDatabase } = await import('../../scripts/start-database.mjs');
  for (const options of [{ volumeError: true }, { repairError: true }]) {
    const h = harness(options);
    await assert.rejects(startDatabase(h.settings, h.deps), /Volume|Compose/);
    assert.equal(h.commands.filter(args => args.includes('--force-recreate')).length, options.volumeError ? 0 : 1);
  }
});

test('PostgreSQL still recovering internally is never force-recreated', async () => {
  const { startDatabase } = await import('../../scripts/start-database.mjs');
  const h = harness({ container: { health: 'starting' } });
  await assert.rejects(startDatabase(h.settings, h.deps), /tempo limite/);
  assert.equal(h.commands.filter(args => args.includes('--force-recreate')).length, 0);
});

test('first installation starts the declared service without forced recreation', async () => {
  const { startDatabase } = await import('../../scripts/start-database.mjs');
  const h = harness({ firstInstall: true, normalStartup: true, staleForwarder: true });
  await startDatabase(h.settings, h.deps);
  assert.equal(h.commands.filter(args => args.includes('up')).length, 1);
  assert.equal(h.commands.filter(args => args.includes('--force-recreate')).length, 0);
});

test('a container left Created after a failed port binding can start normally on the next attempt', async () => {
  const { startDatabase } = await import('../../scripts/start-database.mjs');
  const h = harness({ createdBeforeUp: true, normalStartup: true, staleForwarder: true });
  await startDatabase(h.settings, h.deps);
  assert.equal(h.commands.filter(args => args.includes('up')).length, 1);
  assert.equal(h.commands.filter(args => args.includes('--force-recreate')).length, 0);
});
