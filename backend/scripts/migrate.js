const { loadEnv } = require('../src/loadEnv');

loadEnv();

const fs = require('fs/promises');
const path = require('path');
const { createConfig } = require('../src/config');
const { createPool, withTransaction } = require('../src/db');

async function main() {
  const config = createConfig();
  const pool = createPool(config);
  const migrationsDir = path.join(__dirname, '..', 'migrations');
  const files = (await fs.readdir(migrationsDir)).filter((file) => file.endsWith('.sql')).sort();

  for (const file of files) {
    const version = file.replace(/\.sql$/, '');
    const applied = await pool.query('select 1 from schema_migrations where version = $1', [version]).catch(() => ({ rows: [] }));
    if (applied.rows.length) continue;
    const sql = await fs.readFile(path.join(migrationsDir, file), 'utf8');
    await withTransaction(pool, async (client) => {
      await client.query(sql);
      await client.query('insert into schema_migrations(version) values ($1) on conflict do nothing', [version]);
    });
    console.log(`Applied migration ${version}`);
  }

  await pool.end();
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
