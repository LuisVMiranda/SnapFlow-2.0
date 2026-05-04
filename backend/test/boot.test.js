const test = require('node:test');
const assert = require('node:assert/strict');

test('repository barrel exports createRepos for server boot', () => {
  const { createRepos } = require('../src/repos');

  assert.equal(typeof createRepos, 'function');
});
