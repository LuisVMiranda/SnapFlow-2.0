const assert = require('node:assert/strict');
const test = require('node:test');
const { buildStoredPhone, formatClientPhone, splitStoredPhone, validateClientPhone } = require('../src/services/phone');

test('splitStoredPhone keeps legacy Brazilian digits editable', () => {
  assert.deepEqual(splitStoredPhone('21975191926'), {
    countryCode: '55',
    localNumber: '21975191926',
    stored: '+55 21975191926',
  });
});

test('splitStoredPhone preserves explicit international storage', () => {
  assert.deepEqual(splitStoredPhone('+54 1122334455'), {
    countryCode: '54',
    localNumber: '1122334455',
    stored: '+54 1122334455',
  });
});

test('validateClientPhone accepts Brazil and international numbers', () => {
  assert.equal(validateClientPhone('+55 21975191926').normalized, '5521975191926');
  assert.equal(validateClientPhone('+54 1122334455').normalized, '541122334455');
});

test('validateClientPhone rejects invalid DDI length', () => {
  const result = validateClientPhone({ countryCode: '12345', localNumber: '1122334455' });
  assert.equal(result.valid, false);
  assert.equal(result.code, 'phone_invalid_country_code');
});

test('buildStoredPhone creates a canonical storage format', () => {
  assert.equal(buildStoredPhone({ countryCode: '54', localNumber: '(11) 2233-4455' }), '+54 1122334455');
});

test('buildStoredPhone preserves a chosen DDI before the local number is complete', () => {
  assert.equal(buildStoredPhone({ countryCode: '54', localNumber: '' }), '+54');
  assert.deepEqual(splitStoredPhone('+54'), {
    countryCode: '54',
    localNumber: '',
    stored: '+54',
  });
});

test('formatClientPhone keeps non-Brazilian values readable', () => {
  assert.equal(formatClientPhone('+54 1122334455'), '+54 1122334455');
});
