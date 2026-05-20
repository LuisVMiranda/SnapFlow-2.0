const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const {
  MIGRATION_LOCK_ID,
  runMigrationFiles,
  runMigrations,
} = require('../src/migrations/runMigrations');

async function makeMigrationDir(files = {}) {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'snapflow-migrations-'));
  await Promise.all(Object.entries(files).map(([file, sql]) => fs.writeFile(path.join(dir, file), sql, 'utf8')));
  return dir;
}

function makeFakeClient({ applied = new Set(), noSchema = false } = {}) {
  const queries = [];
  const client = {
    released: false,
    async query(sql, params = []) {
      queries.push({ sql, params });
      if (String(sql).startsWith('select 1 from schema_migrations')) {
        if (noSchema) {
          const error = new Error('relation "schema_migrations" does not exist');
          error.code = '42P01';
          throw error;
        }
        return { rows: applied.has(params[0]) ? [{ exists: true }] : [] };
      }
      if (String(sql).startsWith('insert into schema_migrations')) {
        applied.add(params[0]);
      }
      return { rows: [] };
    },
    release() {
      this.released = true;
    },
  };
  return { client, queries, applied };
}

test('migration runner applies pending SQL files in order', async () => {
  const dir = await makeMigrationDir({
    '002_second.sql': 'select 2;',
    '001_first.sql': 'create table if not exists schema_migrations(version text primary key);',
  });
  const { client, queries } = makeFakeClient();
  const logs = [];

  const appliedVersions = await runMigrationFiles(client, dir, { log: (message) => logs.push(message) });

  assert.deepEqual(appliedVersions, ['001_first', '002_second']);
  assert.deepEqual(logs, ['Applied migration 001_first', 'Applied migration 002_second']);
  assert.equal(queries.filter((entry) => entry.sql === 'BEGIN').length, 2);
  assert.equal(queries.filter((entry) => entry.sql === 'COMMIT').length, 2);
});

test('migration runner skips versions already recorded', async () => {
  const dir = await makeMigrationDir({
    '001_first.sql': 'select 1;',
  });
  const { client } = makeFakeClient({ applied: new Set(['001_first']) });

  const appliedVersions = await runMigrationFiles(client, dir, { log: () => {} });

  assert.deepEqual(appliedVersions, []);
});

test('server migration helper uses an advisory lock and reports an up-to-date schema', async () => {
  const dir = await makeMigrationDir();
  const logs = [];
  const { client, queries } = makeFakeClient();
  const pool = {
    ended: false,
    async connect() {
      return client;
    },
    async end() {
      this.ended = true;
    },
  };

  const result = await runMigrations({}, {
    migrationsDir: dir,
    logger: { log: (message) => logs.push(message) },
    poolFactory: () => pool,
  });

  assert.equal(result.appliedCount, 0);
  assert.deepEqual(result.appliedVersions, []);
  assert.ok(queries.some((entry) => entry.sql === 'select pg_advisory_lock($1)' && entry.params[0] === MIGRATION_LOCK_ID));
  assert.ok(queries.some((entry) => entry.sql === 'select pg_advisory_unlock($1)' && entry.params[0] === MIGRATION_LOCK_ID));
  assert.ok(logs.includes('Aplicando migrações do banco...'));
  assert.ok(logs.includes('Migrações em dia.'));
  assert.equal(client.released, true);
  assert.equal(pool.ended, true);
});

test('gallery metadata migration is defensive for partially migrated databases', async () => {
  const sql = await fs.readFile(path.join(__dirname, '..', 'migrations', '008_gallery_custom_metadata.sql'), 'utf8');

  assert.match(sql, /alter table sessions\s+add column if not exists client_email text not null default '';/i);
  assert.match(sql, /alter table share_sessions\s+add column if not exists client_email text not null default '';/i);
  assert.match(sql, /gallery_name text not null default ''/i);
  assert.match(sql, /gallery_description text not null default ''/i);
});

test('share cart migration persists customer selections by gallery', async () => {
  const sql = await fs.readFile(path.join(__dirname, '..', 'migrations', '013_share_carts.sql'), 'utf8');

  assert.match(sql, /create table if not exists share_carts/i);
  assert.match(sql, /share_token text primary key references share_sessions\(token\) on delete cascade/i);
  assert.match(sql, /photo_ids jsonb not null default '\[\]'::jsonb/i);
});

test('conversion events migration stores funnel analytics', async () => {
  const sql = await fs.readFile(path.join(__dirname, '..', 'migrations', '014_conversion_events.sql'), 'utf8');

  assert.match(sql, /create table if not exists conversion_events/i);
  assert.match(sql, /event_type text not null/i);
  assert.match(sql, /metadata jsonb not null default '\{\}'::jsonb/i);
  assert.match(sql, /conversion_events_event_type_idx/i);
});

test('photo editing preset migration stores source, snapshots and undo metadata', async () => {
  const sql = await fs.readFile(path.join(__dirname, '..', 'migrations', '015_photo_editing_presets.sql'), 'utf8');

  assert.match(sql, /alter table photos/i);
  assert.match(sql, /source_path text/i);
  assert.match(sql, /applied_preset_ids text\[\] not null default '\{\}'/i);
  assert.match(sql, /undo_original_path text/i);
  assert.match(sql, /alter table share_sessions/i);
  assert.match(sql, /photo_preset_ids text\[\] not null default '\{\}'/i);
  assert.match(sql, /photo_preset_undo_snapshot jsonb/i);
  assert.match(sql, /'photoEditingPresets'/i);
});
