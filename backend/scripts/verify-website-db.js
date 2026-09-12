const { spawnSync } = require('node:child_process');
const path = require('node:path');
const { loadEnv } = require('../src/loadEnv');

loadEnv();
const result = spawnSync(process.execPath, ['--test', 'test/website.integration.test.js'], {
  cwd: path.join(__dirname, '..'),
  env: { ...process.env, SNAPFLOW_TEST_DATABASE_URL: process.env.DATABASE_URL },
  stdio: 'inherit',
});
if (result.error) console.error(result.error.message);
process.exitCode = result.status ?? 1;
