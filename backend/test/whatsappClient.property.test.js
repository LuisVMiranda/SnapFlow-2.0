const assert = require('node:assert/strict');
const test = require('node:test');
const fc = require('fast-check');
const {
  createWhatsAppClient,
  friendlyWhatsAppError,
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
