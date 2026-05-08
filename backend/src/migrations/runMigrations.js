const fs = require('fs/promises');
const path = require('path');
const { createPool } = require('../db');

const MIGRATION_LOCK_ID = 2026050801;

async function migrationApplied(client, version) {
  try {
    const result = await client.query('select 1 from schema_migrations where version = $1', [version]);
    return result.rows.length > 0;
  } catch (error) {
    if (error.code !== '42P01') throw error;
    return false;
  }
}

async function applyMigration(client, migrationsDir, file, logger) {
  const version = file.replace(/\.sql$/, '');
  if (await migrationApplied(client, version)) return null;

  const sql = await fs.readFile(path.join(migrationsDir, file), 'utf8');
  await client.query('BEGIN');
  try {
    await client.query(sql);
    await client.query('insert into schema_migrations(version) values ($1) on conflict do nothing', [version]);
    await client.query('COMMIT');
    logger.log(`Applied migration ${version}`);
    return version;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  }
}

async function runMigrationFiles(client, migrationsDir, logger = console) {
  const files = (await fs.readdir(migrationsDir)).filter((file) => file.endsWith('.sql')).sort();
  const appliedVersions = [];

  for (const file of files) {
    const version = await applyMigration(client, migrationsDir, file, logger);
    if (version) appliedVersions.push(version);
  }

  return appliedVersions;
}

async function runMigrations(config, {
  logger = console,
  migrationsDir = path.join(__dirname, '..', '..', 'migrations'),
  poolFactory = createPool,
} = {}) {
  const pool = poolFactory(config);
  const client = await pool.connect();
  logger.log('Aplicando migrações do banco...');

  try {
    await client.query('select pg_advisory_lock($1)', [MIGRATION_LOCK_ID]);
    const appliedVersions = await runMigrationFiles(client, migrationsDir, logger);
    if (!appliedVersions.length) logger.log('Migrações em dia.');
    return { appliedCount: appliedVersions.length, appliedVersions };
  } finally {
    await client.query('select pg_advisory_unlock($1)', [MIGRATION_LOCK_ID]).catch(() => {});
    client.release();
    await pool.end();
  }
}

module.exports = { MIGRATION_LOCK_ID, runMigrationFiles, runMigrations };
