const assert = require('node:assert/strict');
const test = require('node:test');
const { fallbackPayerEmail, optionalEmail, resolvePayerEmail } = require('../src/services/email');

test('optionalEmail keeps valid addresses and drops invalid ones', () => {
  assert.equal(optionalEmail('  ANA@Cliente.COM '), 'ana@cliente.com');
  assert.equal(optionalEmail('email-invalido'), '');
  assert.equal(optionalEmail(''), '');
});

test('resolvePayerEmail falls back to a valid technical address when checkout has no email', () => {
  const fallback = resolvePayerEmail('', 'sessao_pix_123');
  assert.match(fallback, /^sessao-pix-123@snapflow\.app$/);
  assert.equal(resolvePayerEmail('cliente@exemplo.com', 'sessao_pix_123'), 'cliente@exemplo.com');
});

test('fallbackPayerEmail always returns a usable address', () => {
  assert.equal(fallbackPayerEmail('@@@'), 'cliente@snapflow.app');
});
