const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const test = require('node:test');

test('real Docker inspection accepts a Created container with no Health field', {
  skip: process.env.SNAPFLOW_TEST_DOCKER !== '1',
}, async () => {
  const { runCommand } = await import('../../scripts/startup-command.mjs');
  const { inspectDatabase } = await import('../../scripts/docker-database.mjs');
  const docker = process.platform === 'win32' ? 'docker.exe' : 'docker';
  const name = `snapflow-inspect-test-${randomUUID()}`;
  // Never publish a port, run PostgreSQL, or attach an existing volume.
  const created = await runCommand(docker, ['create', '--pull=never', '--name', name,
    '--entrypoint', '/bin/true', 'postgres:16-alpine'], { timeoutMs: 15000 });
  assert.equal(created.code, 0, created.stderr);
  const id = created.stdout.trim();
  assert.match(id, /^[a-f0-9]{64}$/);
  try {
    const ops = { execute: (command, args) => runCommand(command, [...args.slice(0, -1), id], { timeoutMs: 10000 }) };
    const initial = await inspectDatabase(ops);
    assert.equal(initial.status, 'created');
    assert.equal(initial.health, null);
    assert.equal(initial.name, `/${name}`);
    assert.equal(initial.project, null);
    assert.ok(!Object.hasOwn(initial, 'Env'));
    const started = await runCommand(docker, ['start', '-a', id], { timeoutMs: 15000 });
    assert.equal(started.code, 0, started.stderr);
    const exited = await inspectDatabase(ops);
    assert.equal(exited.status, 'exited');
    assert.equal(exited.health, null);
  } finally {
    // Exact ID returned by this test only; also removes its disposable anonymous volume.
    const removed = await runCommand(docker, ['rm', '--force', '--volumes', id], { timeoutMs: 15000 });
    assert.equal(removed.code, 0, removed.stderr);
  }
});

test('inspection template failures retain a useful explanation without logging raw payloads', async () => {
  const { inspectDatabase } = await import('../../scripts/docker-database.mjs');
  await assert.rejects(inspectDatabase({ execute: async () => ({ code: 1,
    stderr: 'template parsing error: map has no entry for key Health; PRIVATE_PAYLOAD' }) }), error => {
    assert.match(error.message, /template/i);
    assert.doesNotMatch(error.message, /PRIVATE_PAYLOAD/);
    return true;
  });
});

test('inspection distinguishes genuine permission errors from timeouts', async () => {
  const { inspectDatabase } = await import('../../scripts/docker-database.mjs');
  for (const [result, expected] of [
    [{ code: 1, stderr: 'permission denied PRIVATE_PAYLOAD' }, /acesso ao Docker negado/],
    [{ code: 1, timedOut: true }, /tempo limite/],
  ]) {
    await assert.rejects(inspectDatabase({ execute: async () => result }), error => {
      assert.match(error.message, expected);
      assert.doesNotMatch(error.message, /PRIVATE_PAYLOAD/);
      return true;
    });
  }
});
