import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const rootEnvPath = path.join(root, '.env');
const backendEnvPath = path.join(root, 'backend', '.env.local');

function readEnv(filePath) {
  if (!fs.existsSync(filePath)) return new Map();
  const entries = new Map();
  for (const line of fs.readFileSync(filePath, 'utf8').split(/\r?\n/)) {
    if (!line || line.trimStart().startsWith('#')) continue;
    const index = line.indexOf('=');
    if (index <= 0) continue;
    entries.set(line.slice(0, index).trim(), line.slice(index + 1).trim());
  }
  return entries;
}

function parseDatabaseUrl(value) {
  const url = new URL(value);
  return {
    POSTGRES_DB: decodeURIComponent(url.pathname.replace(/^\//, '')),
    POSTGRES_PASSWORD: decodeURIComponent(url.password),
    POSTGRES_PORT: String(url.port || 5432),
    POSTGRES_USER: decodeURIComponent(url.username),
  };
}

const rootEnv = readEnv(rootEnvPath);
if (rootEnv.get('SNAPFLOW_DB_MODE')?.toLowerCase() === 'native') {
  console.log('Modo PostgreSQL nativo detectado. .env do Docker não foi alterado.');
  process.exit(0);
}

const backendEnv = readEnv(backendEnvPath);
const databaseUrl = backendEnv.get('DATABASE_URL');
if (!databaseUrl) {
  console.error('DATABASE_URL ausente em backend\\.env.local. Rode INSTALAR_SNAPFLOW.bat antes de iniciar.');
  process.exit(1);
}

let postgresEnv;
try {
  postgresEnv = parseDatabaseUrl(databaseUrl);
} catch {
  console.error('DATABASE_URL inválido em backend\\.env.local. Rode INSTALAR_SNAPFLOW.bat para corrigir.');
  process.exit(1);
}

for (const [key, value] of Object.entries(postgresEnv)) {
  rootEnv.set(key, value);
}

const preferredOrder = [
  'POSTGRES_DB',
  'POSTGRES_USER',
  'POSTGRES_PASSWORD',
  'POSTGRES_PORT',
  'SNAPFLOW_DEV_HOST',
  'SNAPFLOW_DEV_PORT',
  'SNAPFLOW_ALLOWED_HOSTS',
];
const lines = [];
const written = new Set();
for (const key of preferredOrder) {
  if (!rootEnv.has(key)) continue;
  lines.push(`${key}=${rootEnv.get(key)}`);
  written.add(key);
}
for (const [key, value] of rootEnv.entries()) {
  if (!written.has(key)) lines.push(`${key}=${value}`);
}

fs.writeFileSync(rootEnvPath, `${lines.join('\n')}\n`, 'utf8');
console.log('Configuração .env do Docker sincronizada com backend\\.env.local.');
