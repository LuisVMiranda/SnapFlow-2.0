const assert = require('node:assert/strict');
const test = require('node:test');
const fc = require('fast-check');
const { normalizeClientPhone, validateClientPhone } = require('../src/services/whatsappClient');

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
