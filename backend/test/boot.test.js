const test = require('node:test');
const assert = require('node:assert/strict');

test('repository barrel exports createRepos for server boot', () => {
  const { createRepos } = require('../src/repos');

  assert.equal(typeof createRepos, 'function');
});

test('server host defaults to localhost for safer local runs', () => {
  const previousHost = process.env.HOST;
  delete process.env.HOST;

  const { createConfig } = require('../src/config');
  assert.equal(createConfig().host, '127.0.0.1');

  if (previousHost === undefined) delete process.env.HOST;
  else process.env.HOST = previousHost;
});

test('server host can be explicitly opened for VPS or trusted LAN use', () => {
  const previousHost = process.env.HOST;
  process.env.HOST = '0.0.0.0';

  const { createConfig } = require('../src/config');
  assert.equal(createConfig().host, '0.0.0.0');

  if (previousHost === undefined) delete process.env.HOST;
  else process.env.HOST = previousHost;
});
