import { runCommand } from './startup-command.mjs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const executable = name => process.platform === 'win32' ? `${name}.exe` : name;
const candidates = [
  { command: executable('docker'), prefix: ['compose'] },
  { command: executable('docker-compose'), prefix: [] },
];

async function resolveCompose() {
  for (const candidate of candidates) {
    const result = await runCommand(candidate.command, [...candidate.prefix, 'version'], { timeoutMs: 5000 });
    if (result.code === 0) return candidate;
  }
  throw new Error('Docker Compose indisponivel. Confira a instalacao e o engine do Docker Desktop.');
}

try {
  const compose = await resolveCompose();
  const args = process.argv.slice(2);
  // Following logs is an intentional ongoing command, never used by the startup probe.
  const followLogs = args[0] === 'logs' && args.some(arg => ['-f', '--follow'].includes(arg));
  const result = await runCommand(compose.command, [...compose.prefix,
    '--project-directory', root, '--env-file', path.join(root, '.env'),
    '-f', path.join(root, 'docker-compose.yml'), ...args], {
    cwd: root, env: { ...process.env, COMPOSE_REMOVE_ORPHANS: '0' },
    timeoutMs: followLogs ? 0 : 180000, onOutput: data => process.stdout.write(data),
  });
  if (result.timedOut) console.error('Docker Compose excedeu 180s. Confira o Docker Desktop e tente novamente.');
  process.exitCode = result.code;
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
