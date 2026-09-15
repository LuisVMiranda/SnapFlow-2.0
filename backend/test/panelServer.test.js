const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const http = require('node:http');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');

function listen(server) {
  return new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => resolve(server.address().port));
  });
}

function close(server) {
  return new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
}

function requestWithHost(url, host) {
  return new Promise((resolve, reject) => {
    const request = http.get(url, { headers: { Host: host } }, (response) => {
      const chunks = [];
      response.on('data', (chunk) => chunks.push(chunk));
      response.on('end', () => resolve({
        body: Buffer.concat(chunks).toString('utf8'),
        headers: response.headers,
        status: response.statusCode,
      }));
    });
    request.on('error', reject);
  });
}

test('production panel server uses stable caching, SPA fallback, host checks and API proxying', async () => {
  const { createPanelServer } = await import('../../scripts/panel-server.mjs');
  const distRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'snapflow-panel-'));
  await fs.mkdir(path.join(distRoot, 'assets'));
  await fs.writeFile(path.join(distRoot, 'index.html'), '<meta name="snapflow-service" content="snapflow-panel"><h1>Panel</h1>');
  await fs.writeFile(path.join(distRoot, 'assets/app-abc123.js'), 'globalThis.loaded=true');
  const api = http.createServer((request, response) => {
    response.writeHead(200, { 'content-type': 'application/json' });
    response.end(JSON.stringify({ path: request.url, host: request.headers.host }));
  });
  const apiPort = await listen(api);
  const panel = createPanelServer({ apiPort, allowedHosts: ['panel.example.ts.net'], distRoot });
  const panelPort = await listen(panel);
  const base = `http://127.0.0.1:${panelPort}`;
  try {
    const home = await requestWithHost(base, 'panel.example.ts.net:8443');
    assert.equal(home.status, 200);
    assert.match(home.body, /snapflow-panel/);
    assert.equal(home.headers['cache-control'], 'no-store');
    assert.equal(home.headers['x-snapflow-service'], 'panel');

    const asset = await fetch(`${base}/assets/app-abc123.js`, { headers: { Host: 'panel.example.ts.net:8443' } });
    assert.equal(asset.status, 200);
    assert.match(asset.headers.get('content-type'), /javascript/);
    assert.match(asset.headers.get('cache-control'), /immutable/);

    const gallery = await fetch(`${base}/s/gallery-token`, { headers: { Host: 'panel.example.ts.net:8443' } });
    assert.equal(gallery.status, 200);
    assert.match(await gallery.text(), /snapflow-panel/);

    const proxied = await fetch(`${base}/api/health?probe=1`, { headers: { Host: 'panel.example.ts.net:8443' } });
    assert.deepEqual(await proxied.json(), { path: '/api/health?probe=1', host: `127.0.0.1:${apiPort}` });

    assert.equal((await fetch(`${base}/assets/missing.js`, { headers: { Host: 'panel.example.ts.net' } })).status, 404);
    assert.equal((await requestWithHost(base, 'attacker.example')).status, 403);
  } finally {
    await close(panel);
    await close(api);
    await fs.rm(distRoot, { recursive: true, force: true });
  }
});
