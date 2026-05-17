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

test('auto enhance is enabled by default and can be disabled by environment', () => {
  const previousAutoEnhance = process.env.AUTO_ENHANCE;
  const previousAutoEnhanceLevel = process.env.AUTO_ENHANCE_LEVEL;
  delete process.env.AUTO_ENHANCE;
  delete process.env.AUTO_ENHANCE_LEVEL;

  const { createConfig } = require('../src/config');
  assert.equal(createConfig().autoEnhanceEnabled, true);
  assert.equal(createConfig().autoEnhanceLevel, 'balanced');

  process.env.AUTO_ENHANCE = 'false';
  assert.equal(createConfig().autoEnhanceEnabled, false);

  process.env.AUTO_ENHANCE_LEVEL = 'cinematic';
  assert.equal(createConfig().autoEnhanceLevel, 'cinematic');

  process.env.AUTO_ENHANCE_LEVEL = 'unknown';
  assert.equal(createConfig().autoEnhanceLevel, 'balanced');

  if (previousAutoEnhance === undefined) delete process.env.AUTO_ENHANCE;
  else process.env.AUTO_ENHANCE = previousAutoEnhance;
  if (previousAutoEnhanceLevel === undefined) delete process.env.AUTO_ENHANCE_LEVEL;
  else process.env.AUTO_ENHANCE_LEVEL = previousAutoEnhanceLevel;
});

test('upload processing concurrency is bounded for local machines', () => {
  const previous = process.env.UPLOAD_PROCESSING_CONCURRENCY;
  const { createConfig } = require('../src/config');

  process.env.UPLOAD_PROCESSING_CONCURRENCY = '99';
  assert.equal(createConfig().uploadProcessingConcurrency, 6);

  process.env.UPLOAD_PROCESSING_CONCURRENCY = '0';
  assert.equal(createConfig().uploadProcessingConcurrency, 3);

  process.env.UPLOAD_PROCESSING_CONCURRENCY = '2';
  assert.equal(createConfig().uploadProcessingConcurrency, 2);

  if (previous === undefined) delete process.env.UPLOAD_PROCESSING_CONCURRENCY;
  else process.env.UPLOAD_PROCESSING_CONCURRENCY = previous;
});
