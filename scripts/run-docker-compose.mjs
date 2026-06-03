import { spawnSync } from 'node:child_process';

const args = process.argv.slice(2);

const candidates = [
  { command: 'docker', prefix: ['compose'] },
  { command: 'docker-compose', prefix: [] },
];

function run(command, argsToRun, options = {}) {
  return spawnSync(command, argsToRun, {
    shell: process.platform === 'win32',
    stdio: options.stdio || 'inherit',
  });
}

function resolveCompose() {
  for (const candidate of candidates) {
    const result = run(candidate.command, [...candidate.prefix, 'version'], { stdio: 'ignore' });
    if (result.status === 0) return candidate;
  }
  return null;
}

const compose = resolveCompose();

if (!compose) {
  console.error('Docker Compose não foi encontrado. Instale Docker Desktop ou docker-compose.');
  process.exit(1);
}

const result = run(compose.command, [...compose.prefix, ...args]);
process.exit(result.status ?? 1);
