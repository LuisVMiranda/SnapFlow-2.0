import net from 'node:net';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const DEFAULT_REQUEST_TIMEOUT_MS = 2500;

export function normalizeTcpPort(value) {
  const port = Number(value);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error(`Porta inválida: ${value}. Use um número entre 1 e 65535.`);
  }
  return port;
}

export function isTcpPortOpen({ host = '127.0.0.1', port, timeoutMs = 750 } = {}) {
  const normalizedPort = normalizeTcpPort(port);
  return new Promise((resolve) => {
    const socket = net.createConnection({ host, port: normalizedPort });
    let settled = false;
    const finish = (open) => {
      if (settled) return;
      settled = true;
      socket.destroy();
      resolve(open);
    };
    socket.setTimeout(timeoutMs, () => finish(false));
    socket.once('connect', () => finish(true));
    socket.once('error', () => finish(false));
  });
}

function positiveInteger(value, fallback) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

function sleep(delayMs) {
  return new Promise((resolve) => setTimeout(resolve, delayMs));
}

function compactBody(text) {
  return String(text || '').replace(/\s+/g, ' ').trim().slice(0, 120);
}

function resolvedWaitOptions(options) {
  return {
    attempts: positiveInteger(options.attempts, 60),
    delayMs: positiveInteger(options.delayMs, 1000),
    pause: options.pause || sleep,
    request: options.request || fetch,
    timeoutMs: positiveInteger(options.timeoutMs, DEFAULT_REQUEST_TIMEOUT_MS),
    url: options.url,
    validate: options.validate,
  };
}

function httpFailure(response, text) {
  const body = compactBody(text);
  return body ? `HTTP ${response.status}: ${body}` : `HTTP ${response.status}`;
}

async function probeEndpoint(options) {
  try {
    const response = await options.request(options.url, {
      headers: { Accept: 'application/json, text/html;q=0.9' },
      signal: AbortSignal.timeout(options.timeoutMs),
    });
    const text = await response.text();
    if (response.ok && options.validate({ response, text })) return { ready: true, response, text };
    return { ready: false, failure: httpFailure(response, text) };
  } catch (error) {
    return { ready: false, failure: error?.message || String(error || 'falha de conexão') };
  }
}

export async function waitForEndpoint(options = {}) {
  const settings = resolvedWaitOptions(options);
  let lastFailure = 'sem resposta';

  for (let attempt = 1; attempt <= settings.attempts; attempt += 1) {
    const result = await probeEndpoint(settings);
    if (result.ready) return { attempt, response: result.response, text: result.text };
    lastFailure = result.failure;
    if (attempt < settings.attempts) await settings.pause(settings.delayMs);
  }

  throw new Error(`${settings.url} não ficou pronto após ${settings.attempts} tentativa(s). Último retorno: ${lastFailure}`);
}

function isSnapFlowApiResponse({ text }) {
  try {
    const data = JSON.parse(text);
    return data.ok === true && data.service === 'snapflow-api' && data.status === 'ready';
  } catch {
    return false;
  }
}

function isSnapFlowPanelResponse({ text }) {
  return /<title>\s*SnapFlow\b/i.test(text);
}

export function waitForSnapFlowApi(options = {}) {
  return waitForEndpoint({ ...options, validate: isSnapFlowApiResponse });
}

export function waitForSnapFlowPanel(options = {}) {
  return waitForEndpoint({ ...options, validate: isSnapFlowPanelResponse });
}

async function assertPortFree(label, value) {
  const port = normalizeTcpPort(value);
  if (!await isTcpPortOpen({ port })) return;
  throw new Error(
    `A porta ${port} (${label}) já está em uso. Feche a janela antiga ou o outro aplicativo antes de iniciar o SnapFlow.`
  );
}

async function runCli([command, ...args]) {
  if (command === 'assert-port') {
    await assertPortFree(args[0] || 'serviço', args[1]);
    console.log(`Porta ${args[1]} livre para ${args[0] || 'serviço'}.`);
    return;
  }
  if (command === 'wait-api') {
    await waitForSnapFlowApi({ url: args[0], attempts: args[1], delayMs: args[2] });
    console.log('API SnapFlow pronta.');
    return;
  }
  if (command === 'wait-panel') {
    await waitForSnapFlowPanel({ url: args[0], attempts: args[1], delayMs: args[2] });
    console.log('Painel SnapFlow pronto.');
    return;
  }
  throw new Error('Comando inválido. Use assert-port, wait-api ou wait-panel.');
}

const entryUrl = process.argv[1] ? pathToFileURL(path.resolve(process.argv[1])).href : '';
if (import.meta.url === entryUrl) {
  runCli(process.argv.slice(2)).catch((error) => {
    console.error(`ERRO: ${error.message}`);
    process.exitCode = 1;
  });
}
