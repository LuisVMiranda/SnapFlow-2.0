import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(new URL('../backend/package.json', import.meta.url));
const { parse } = require('dotenv');
const { Client } = require('pg');

export function readEnv(file) {
  try { return parse(fs.readFileSync(file)); }
  catch (error) { if (error.code === 'ENOENT') return {}; throw error; }
}

function parseDatabaseUrl(value) {
  let url;
  try { url = new URL(value); }
  catch { throw new Error('DATABASE_URL ausente ou invalida em backend\\.env.local. Confira a configuracao do banco.'); }
  if (!['postgres:', 'postgresql:'].includes(url.protocol) || !url.hostname || url.pathname.length < 2) {
    throw new Error('DATABASE_URL precisa identificar um banco PostgreSQL.');
  }
  return url;
}

function databaseMode(rootEnv, environment) {
  const mode = String(rootEnv.SNAPFLOW_DB_MODE || environment.SNAPFLOW_DB_MODE || 'docker').toLowerCase();
  if (!['docker', 'native'].includes(mode)) throw new Error('SNAPFLOW_DB_MODE deve ser docker ou native.');
  return mode;
}

export function loadDatabaseSettings(root, environment = process.env) {
  const rootEnv = readEnv(path.join(root, '.env'));
  const backendEnv = {
    ...readEnv(path.join(root, 'backend/.env')), ...environment,
    ...readEnv(path.join(root, 'backend/.env.local')),
  };
  const url = parseDatabaseUrl(backendEnv.DATABASE_URL);
  const mode = databaseMode(rootEnv, environment);
  const local = ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
  if (mode === 'docker' && !local) throw new Error('Modo Docker local exige DATABASE_URL local. Confira o hostname e SNAPFLOW_DB_MODE.');
  const dockerEnv = {
    POSTGRES_PORT: url.port || '5432', POSTGRES_USER: decodeURIComponent(url.username),
    POSTGRES_PASSWORD: decodeURIComponent(url.password), POSTGRES_DB: decodeURIComponent(url.pathname.slice(1)),
  };
  return {
    root, mode, local, databaseUrl: url.href, target: `${url.hostname}:${url.port || '5432'}`,
    service: rootEnv.POSTGRES_SERVICE || environment.POSTGRES_SERVICE || '',
    // Explicit mapping wins over stale inherited POSTGRES_* environment variables.
    env: { ...environment, ...rootEnv, ...dockerEnv, DATABASE_URL: backendEnv.DATABASE_URL },
    secrets: [url.href, backendEnv.DATABASE_URL, url.password, dockerEnv.POSTGRES_PASSWORD],
  };
}

export function databaseFailure(error) {
  const code = error?.code || '';
  if (['28P01', '28000'].includes(code)) return { ready: false, fatal: true, detail: 'Credenciais PostgreSQL recusadas. Confira DATABASE_URL; mudar POSTGRES_PASSWORD nao altera a senha de um volume ja existente.' };
  if (code === '3D000') return { ready: false, fatal: true, detail: 'Banco configurado nao existe. Confira o nome em DATABASE_URL; preserve o volume existente.' };
  if (code === 'ENOTFOUND') return { ready: false, fatal: true, detail: 'Hostname PostgreSQL nao encontrado. Confira DATABASE_URL.' };
  const descriptions = {
    ECONNREFUSED: 'conexao recusada na porta configurada',
    '57P03': 'PostgreSQL inicializando ou recuperando dados',
    ETIMEDOUT: 'PostgreSQL nao respondeu a tempo',
  };
  return { ready: false, detail: descriptions[code] || 'PostgreSQL ainda nao confirmou autenticacao e consulta' };
}

export async function probeDatabase(databaseUrl, timeoutMs = 3000) {
  const client = new Client({ connectionString: databaseUrl, connectionTimeoutMillis: timeoutMs,
    query_timeout: timeoutMs, statement_timeout: timeoutMs, application_name: 'snapflow-startup-check' });
  client.on('error', () => {});
  // Independent wall-clock deadline also covers unusual connection-string timeout settings.
  let timer;
  try {
    const check = async () => { await client.connect(); await client.query('SELECT 1'); return { ready: true }; };
    return await Promise.race([
      check(),
      new Promise(resolve => { timer = setTimeout(() => resolve(databaseFailure({ code: 'ETIMEDOUT' })), timeoutMs * 2); }),
    ]);
  } catch (error) { return databaseFailure(error); }
  finally { clearTimeout(timer); await client.end().catch(() => {}); }
}

export function redact(text, secrets = []) {
  let result = String(text).replace(/postgres(?:ql)?:\/\/[^\s]+/gi, '[DATABASE_URL]');
  for (const secret of secrets.filter(Boolean)) result = result.split(secret).join('[oculto]');
  return result;
}
