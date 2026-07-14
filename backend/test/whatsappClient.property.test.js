const assert = require('node:assert/strict');
const { EventEmitter } = require('node:events');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const test = require('node:test');
const fc = require('fast-check');
const {
  createWhatsAppClient,
  friendlyWhatsAppError,
  isWhatsAppRecoverableProcessError,
  isTransientWhatsAppError,
  normalizeClientPhone,
  validateClientPhone,
} = require('../src/services/whatsappClient');

const digitText = (minLength, maxLength) =>
  fc.array(fc.integer({ min: 0, max: 9 }), { minLength, maxLength }).map((digits) => digits.join(''));

test('normalizeClientPhone keeps explicit international numbers normalized to digits only', () => {
  fc.assert(
    fc.property(
      fc.integer({ min: 1, max: 9999 }).map(String),
      digitText(6, 11),
      (countryCode, localNumber) => {
        const normalized = normalizeClientPhone(`+${countryCode} ${localNumber}`);
        assert.equal(normalized, `${countryCode}${localNumber}`);
      }
    )
  );
});

test('normalizeClientPhone keeps invalid short inputs invalid', () => {
  fc.assert(
    fc.property(digitText(0, 5), (digits) => {
      const normalized = normalizeClientPhone(`+54 ${digits}`);
      assert.ok(normalized.length <= 7);
    })
  );
});

test('validateClientPhone preserves total digit limits', () => {
  fc.assert(
    fc.property(
      fc.integer({ min: 1, max: 9999 }).map(String),
      digitText(1, 14),
      (countryCode, localNumber) => {
        const result = validateClientPhone({ countryCode, localNumber });
        if (result.valid) {
          assert.ok(result.normalized.length >= 7);
          assert.ok(result.normalized.length <= 15);
        }
      }
    )
  );
});

test('detached WhatsApp frames are treated as recoverable WhatsApp failures', () => {
  const error = new Error("Attempted to use detached Frame 'FAD6A8E80ABEAF0C100475BFFDD7E5DC5'.");
  assert.equal(isTransientWhatsAppError(error), true);
  assert.match(friendlyWhatsAppError(error).message, /A API continua ativa/);
});

test('WhatsApp error helpers tolerate missing error objects', () => {
  assert.equal(isTransientWhatsAppError(null), false);
  assert.match(friendlyWhatsAppError(null).message, /Falha no WhatsApp/);
});

test('only WhatsApp LocalAuth filesystem locks are recoverable process failures', () => {
  const whatsappLock = new Error("Error: EBUSY: resource busy or locked, unlink 'C:\\SnapFlow\\backend\\.wwebjs_auth\\session-test\\lockfile'");
  whatsappLock.stack = `${whatsappLock.message}\n    at LocalAuth.logout (C:\\SnapFlow\\backend\\node_modules\\whatsapp-web.js\\src\\authStrategies\\LocalAuth.js:65:27)`;
  const unrelatedLock = new Error("EBUSY: resource busy or locked, unlink 'C:\\other\\database.lock'");
  unrelatedLock.stack = `${unrelatedLock.message}\n    at saveDatabase (C:\\other\\database.js:10:2)`;

  assert.equal(isWhatsAppRecoverableProcessError(whatsappLock), true);
  assert.equal(isWhatsAppRecoverableProcessError(unrelatedLock), false);
});

test('WhatsApp status is safe before the client has any error', async () => {
  const whatsapp = createWhatsAppClient();
  try {
    const status = whatsapp.getStatus();
    assert.equal(status.ready, false);
    assert.equal(status.status, 'idle');
    assert.equal(status.lastError, null);
    assert.equal(status.hasQr, false);
  } finally {
    await whatsapp.shutdown();
  }
});

test('WhatsApp send before pairing returns guidance instead of crashing on null error', async () => {
  const whatsapp = createWhatsAppClient();
  try {
    await assert.rejects(
      () => whatsapp.sendText({ countryCode: '55', localNumber: '11999999999' }, 'teste'),
      /Abra Vendas > WhatsApp de envio/
    );
  } finally {
    await whatsapp.shutdown();
  }
});

test('manual reconnect reuses an initialization already in progress', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'snapflow-whatsapp-init-'));
  const initializeResolvers = [];
  let clientCreations = 0;
  let signalFirstClient;
  const firstClientCreated = new Promise((resolve) => {
    signalFirstClient = resolve;
  });
  const whatsapp = createWhatsAppClient({
    authDataPath: path.join(root, 'auth'),
    cachePath: path.join(root, 'cache'),
    clientFactory: () => {
      clientCreations += 1;
      signalFirstClient();
      const fakeClient = new EventEmitter();
      fakeClient.pupBrowser = { close: async () => {} };
      fakeClient.destroy = async () => {};
      fakeClient.initialize = () => new Promise((resolve) => initializeResolvers.push(resolve));
      return fakeClient;
    },
    clientIdPath: path.join(root, 'client-id'),
  });

  try {
    const initial = whatsapp.initialize();
    const reconnect = whatsapp.reconnect();
    await firstClientCreated;
    await new Promise((resolve) => setImmediate(resolve));
    assert.equal(clientCreations, 1);
    assert.equal(initializeResolvers.length, 1);
    initializeResolvers[0]();
    await Promise.all([initial, reconnect]);
  } finally {
    await whatsapp.shutdown();
    await fs.rm(root, { recursive: true, force: true });
  }
});

test('Windows LocalAuth lock rejection keeps the API process alive and schedules recovery', () => {
  const backendRoot = path.resolve(__dirname, '..');
  const script = String.raw`
    const fs = require('node:fs');
    const http = require('node:http');
    const os = require('node:os');
    const path = require('node:path');
    const { createWhatsAppClient } = require('./src/services/whatsappClient');
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'snapflow-whatsapp-lock-'));
    const whatsapp = createWhatsAppClient({
      authDataPath: path.join(root, 'auth'),
      cachePath: path.join(root, 'cache'),
      clientIdPath: path.join(root, 'client-id'),
    });
    const server = http.createServer((request, response) => {
      response.setHeader('Content-Type', 'application/json');
      response.end(JSON.stringify({ ok: true, service: 'snapflow-api' }));
    });
    const error = new Error("Error: EBUSY: resource busy or locked, unlink '" + path.join(root, "auth", "session-test", "lockfile") + "'");
    error.stack = error.message + '\n    at LocalAuth.logout (C:\\SnapFlow\\backend\\node_modules\\whatsapp-web.js\\src\\authStrategies\\LocalAuth.js:65:27)';
    server.listen(0, '127.0.0.1', () => {
      Promise.reject(error);
      setTimeout(async () => {
        const response = await fetch('http://127.0.0.1:' + server.address().port + '/health');
        console.log(JSON.stringify({ health: await response.json(), whatsapp: whatsapp.getStatus() }));
        await whatsapp.shutdown();
        await new Promise((resolve) => server.close(resolve));
        fs.rmSync(root, { recursive: true, force: true });
      }, 50);
    });
  `;

  const result = spawnSync(process.execPath, ['-e', script], {
    cwd: backendRoot,
    encoding: 'utf8',
    timeout: 5000,
  });

  assert.equal(result.status, 0, result.stderr || result.stdout);
  const resultPayload = JSON.parse(result.stdout.trim().split(/\r?\n/).at(-1));
  assert.deepEqual(resultPayload.health, { ok: true, service: 'snapflow-api' });
  assert.equal(resultPayload.whatsapp.ready, false);
  assert.equal(resultPayload.whatsapp.status, 'waiting_retry');
  assert.match(resultPayload.whatsapp.clientId, /^snapflow2-/);
  assert.match(resultPayload.whatsapp.lastError, /perfil local do WhatsApp ficou preso/i);
});
