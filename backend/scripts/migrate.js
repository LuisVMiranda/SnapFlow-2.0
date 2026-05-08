const { loadEnv } = require('../src/loadEnv');

loadEnv();

const fs = require('fs/promises');
const path = require('path');
const { createConfig } = require('../src/config');
const { runMigrations } = require('../src/migrations/runMigrations');

async function main() {
  const config = createConfig();
  const migrationsDir = path.join(__dirname, '..', 'migrations');
  await fs.access(migrationsDir);
  await runMigrations(config, { migrationsDir });
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
