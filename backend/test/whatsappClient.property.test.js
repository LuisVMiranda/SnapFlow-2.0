const assert = require('node:assert/strict');
const test = require('node:test');
const fc = require('fast-check');
const { normalizeBrazilPhone } = require('../src/services/whatsappClient');

const digitText = (minLength, maxLength) =>
  fc.array(fc.integer({ min: 0, max: 9 }), { minLength, maxLength }).map((digits) => digits.join(''));

test('normalizeBrazilPhone prefixes Brazilian 10/11 digit numbers with 55', () => {
  fc.assert(
    fc.property(digitText(10, 11), (digits) => {
      const normalized = normalizeBrazilPhone(digits);
      assert.equal(normalized, `55${digits}`);
    })
  );
});

test('normalizeBrazilPhone keeps invalid short inputs invalid', () => {
  fc.assert(
    fc.property(digitText(0, 9), (digits) => {
      const normalized = normalizeBrazilPhone(`(${digits})`);
      assert.ok(normalized.length < 10);
    })
  );
});
