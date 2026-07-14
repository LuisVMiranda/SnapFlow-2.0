const assert = require('node:assert/strict');
const net = require('node:net');
const test = require('node:test');
const fc = require('fast-check');

async function startupRuntime() {
  return import('../../scripts/snapflow-startup.mjs');
}

function response(body, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    text: async () => typeof body === 'string' ? body : JSON.stringify(body),
  };
}

test('startup TCP port normalization accepts the complete valid range', async () => {
  const { normalizeTcpPort } = await startupRuntime();

  fc.assert(fc.property(fc.integer({ min: 1, max: 65535 }), (port) => {
    assert.equal(normalizeTcpPort(String(port)), port);
  }));
  for (const invalid of [0, -1, 65536, 'abc', 3.5, null]) {
    assert.throws(() => normalizeTcpPort(invalid), /Porta inválida/);
  }
});

test('startup port probe detects a real occupied loopback port', async () => {
  const { isTcpPortOpen } = await startupRuntime();
  const server = net.createServer();
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const port = server.address().port;

  try {
    assert.equal(await isTcpPortOpen({ port }), true);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
  assert.equal(await isTcpPortOpen({ port }), false);
});

test('startup API readiness retries a gateway failure and verifies SnapFlow identity', async () => {
  const { waitForSnapFlowApi } = await startupRuntime();
  const replies = [
    response('Bad Gateway', 502),
    response({ ok: true, service: 'snapflow-api', status: 'ready' }),
  ];
  const pauses = [];

  const result = await waitForSnapFlowApi({
    attempts: 3,
    delayMs: 25,
    pause: async (delay) => pauses.push(delay),
    request: async () => replies.shift(),
    url: 'http://127.0.0.1:3000/api/health',
  });

  assert.equal(result.attempt, 2);
  assert.deepEqual(pauses, [25]);
});

test('startup API readiness rejects an unrelated service on the expected port', async () => {
  const { waitForSnapFlowApi } = await startupRuntime();

  await assert.rejects(() => waitForSnapFlowApi({
    attempts: 1,
    pause: async () => {},
    request: async () => response({ ok: true, service: 'another-app', status: 'ready' }),
    url: 'http://127.0.0.1:3000/api/health',
  }), /não ficou pronto/);
});
