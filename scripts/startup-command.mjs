import { spawn, spawnSync } from 'node:child_process';

function stopChild(child) {
  if (!child.pid) return;
  let cleanupError;
  if (process.platform === 'win32') {
    // Only the process tree created by this invocation; never all node/docker processes.
    const result = spawnSync('taskkill.exe', ['/PID', String(child.pid), '/T', '/F'], {
      windowsHide: true, stdio: 'ignore', timeout: 5000,
    });
    if (result.status !== 0) cleanupError = `Nao foi possivel confirmar o encerramento dos subprocessos do PID ${child.pid}. Verifique as permissoes do Windows.`;
  }
  child.kill('SIGKILL');
  return cleanupError;
}

export function runCommand(command, args, options = {}) {
  return new Promise(resolve => {
    let stdout = '';
    let stderr = '';
    let finished = false;
    const started = Date.now();
    const child = spawn(command, args, {
      cwd: options.cwd, env: options.env || process.env,
      windowsHide: true, shell: false, stdio: ['ignore', 'pipe', 'pipe'],
    });
    const finish = result => {
      if (finished) return;
      finished = true;
      clearTimeout(timer);
      clearInterval(progress);
      resolve({ stdout, stderr, timedOut: false, ...result });
    };
    const timer = options.timeoutMs === 0 ? null : setTimeout(() => {
      const cleanupError = stopChild(child);
      if (cleanupError) stderr += `\n${cleanupError}`;
      finish({ code: 1, timedOut: true, cleanupError });
    }, options.timeoutMs || 10000);
    const progress = setInterval(() => options.onProgress?.(Date.now() - started), 10000);
    child.stdout.on('data', data => {
      stdout = (stdout + data).slice(-65536);
      options.onOutput?.(String(data));
    });
    child.stderr.on('data', data => {
      stderr = (stderr + data).slice(-65536);
      options.onOutput?.(String(data));
    });
    child.once('error', error => finish({ code: 1, errorCode: error.code }));
    child.once('close', code => finish({ code: code ?? 1 }));
  });
}

function waitOptions(options) {
  return { now: Date.now, pause: ms => new Promise(resolve => setTimeout(resolve, ms)),
    log: console.log, timeoutMs: 90000, delayMs: 2000, ...options };
}

export async function waitUntil(label, probe, options = {}) {
  const { now, pause, log, timeoutMs, delayMs } = waitOptions(options);
  const started = now();
  let last = 'sem resposta';
  while (now() - started < timeoutMs) {
    const remaining = timeoutMs - (now() - started);
    const result = await probe(remaining);
    if (result.ready) return;
    if (result.fatal) throw new Error(result.detail);
    last = result.detail || last;
    const elapsed = now() - started;
    log(`${label}: ${Math.ceil(elapsed / 1000)}/${Math.ceil(timeoutMs / 1000)}s - ${last}`);
    const delay = Math.min(delayMs, timeoutMs - elapsed);
    if (delay > 0) await pause(delay);
  }
  throw new Error(`${label}: tempo limite atingido. ${last}`);
}
