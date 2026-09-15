import fs from 'node:fs';
import fsp from 'node:fs/promises';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const defaultDistRoot = path.join(projectRoot, 'dist', 'panel');
const localHosts = new Set(['127.0.0.1', 'localhost', '::1']);
const mimeTypes = new Map([
  ['.css', 'text/css; charset=utf-8'],
  ['.html', 'text/html; charset=utf-8'],
  ['.ico', 'image/x-icon'],
  ['.jpeg', 'image/jpeg'],
  ['.jpg', 'image/jpeg'],
  ['.js', 'text/javascript; charset=utf-8'],
  ['.json', 'application/json; charset=utf-8'],
  ['.png', 'image/png'],
  ['.svg', 'image/svg+xml; charset=utf-8'],
  ['.webp', 'image/webp'],
  ['.woff', 'font/woff'],
  ['.woff2', 'font/woff2'],
]);

function normalizeHost(value) {
  const source = String(value || '').trim();
  if (!source) return '';
  try {
    return new URL(source.includes('://') ? source : `http://${source}`)
      .hostname.toLowerCase().replace(/^\[|\]$/g, '');
  }
  catch { return source.replace(/^\[|\]$/g, '').split(':')[0].toLowerCase(); }
}

function allowedHostSet(hosts) {
  return new Set([...localHosts, ...hosts.map(normalizeHost).filter(Boolean)]);
}

function isAllowedRequest(request, hosts) {
  return hosts.has(normalizeHost(request.headers.host));
}

function commonHeaders(contentType) {
  return {
    'Content-Type': contentType,
    'Referrer-Policy': 'same-origin',
    'X-Content-Type-Options': 'nosniff',
    'X-SnapFlow-Service': 'panel',
  };
}

function cacheControl(filePath, requestPath) {
  if (path.basename(filePath) === 'index.html') return 'no-store';
  if (requestPath.startsWith('/assets/')) return 'public, max-age=31536000, immutable';
  return 'no-cache';
}

function sendText(response, status, message) {
  response.writeHead(status, commonHeaders('text/plain; charset=utf-8'));
  response.end(message);
}

function proxyRequest(request, response, apiPort) {
  const headers = { ...request.headers, host: `127.0.0.1:${apiPort}` };
  const upstream = http.request({
    headers,
    host: '127.0.0.1',
    method: request.method,
    path: request.url,
    port: apiPort,
  }, (upstreamResponse) => {
    response.writeHead(upstreamResponse.statusCode || 502, upstreamResponse.headers);
    upstreamResponse.pipe(response);
  });
  upstream.on('error', () => {
    if (response.headersSent) return response.destroy();
    response.writeHead(503, commonHeaders('application/json; charset=utf-8'));
    response.end(JSON.stringify({
      code: 'api_unavailable',
      error: 'A API do SnapFlow está iniciando ou temporariamente indisponível.',
    }));
  });
  request.pipe(upstream);
}

function resolvedAssetPath(distRoot, pathname) {
  let decoded;
  try { decoded = decodeURIComponent(pathname); } catch { return null; }
  const relative = decoded.replace(/^[/\\]+/, '').replaceAll('\\', '/');
  const candidate = path.resolve(distRoot, relative || 'index.html');
  const rootPrefix = `${path.resolve(distRoot)}${path.sep}`;
  return candidate === path.resolve(distRoot) || candidate.startsWith(rootPrefix) ? candidate : null;
}

async function regularFile(filePath) {
  try { return (await fsp.stat(filePath)).isFile(); } catch { return false; }
}

async function serveFile(request, response, filePath, requestPath) {
  const contentType = mimeTypes.get(path.extname(filePath).toLowerCase()) || 'application/octet-stream';
  const headers = { ...commonHeaders(contentType), 'Cache-Control': cacheControl(filePath, requestPath) };
  response.writeHead(200, headers);
  if (request.method === 'HEAD') return response.end();
  const stream = fs.createReadStream(filePath);
  stream.on('error', () => response.destroy());
  stream.pipe(response);
}

async function servePanelRequest(request, response, distRoot) {
  if (!['GET', 'HEAD'].includes(request.method || 'GET')) return sendText(response, 405, 'Método não permitido.');
  const requestPath = new URL(request.url || '/', 'http://localhost').pathname;
  const candidate = resolvedAssetPath(distRoot, requestPath);
  if (!candidate) return sendText(response, 400, 'Caminho inválido.');
  if (await regularFile(candidate)) return serveFile(request, response, candidate, requestPath);
  if (path.extname(requestPath)) return sendText(response, 404, 'Arquivo não encontrado.');
  return serveFile(request, response, path.join(distRoot, 'index.html'), requestPath);
}

export function createPanelServer({ apiPort, allowedHosts = [], distRoot = defaultDistRoot } = {}) {
  const normalizedApiPort = Number(apiPort) || 3000;
  const hosts = allowedHostSet(allowedHosts);
  return http.createServer((request, response) => {
    if (!isAllowedRequest(request, hosts)) return sendText(response, 403, 'Host não autorizado.');
    const pathname = new URL(request.url || '/', 'http://localhost').pathname;
    if (pathname === '/api' || pathname.startsWith('/api/') || pathname.startsWith('/uploads/')) {
      return proxyRequest(request, response, normalizedApiPort);
    }
    servePanelRequest(request, response, distRoot).catch(() => sendText(response, 500, 'Falha ao carregar o painel.'));
  });
}

function parseEnvFile(filePath) {
  try {
    return Object.fromEntries(fs.readFileSync(filePath, 'utf8').split(/\r?\n/).flatMap((line) => {
      const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$/);
      return match ? [[match[1], match[2].replace(/^(['"])(.*)\1$/, '$2')]] : [];
    }));
  } catch { return {}; }
}

function runtimeEnv() {
  return {
    ...parseEnvFile(path.join(projectRoot, '.env')),
    ...parseEnvFile(path.join(projectRoot, 'backend', '.env.local')),
    ...process.env,
  };
}

async function runCli() {
  const env = runtimeEnv();
  const distRoot = env.SNAPFLOW_PANEL_DIST || defaultDistRoot;
  if (!await regularFile(path.join(distRoot, 'index.html'))) {
    throw new Error('O painel compilado não foi encontrado. Execute npm run build:panel antes de iniciar.');
  }
  const host = env.SNAPFLOW_DEV_HOST || '127.0.0.1';
  const port = Number(env.SNAPFLOW_DEV_PORT) || 5173;
  const allowedHosts = String(env.SNAPFLOW_ALLOWED_HOSTS || '').split(',').map((item) => item.trim()).filter(Boolean);
  const server = createPanelServer({ apiPort: env.SNAPFLOW_API_PORT || env.PORT, allowedHosts, distRoot });
  server.on('error', (error) => { console.error(`ERRO: ${error.message}`); process.exitCode = 1; });
  server.listen(port, host, () => console.log(`Painel SnapFlow de produção pronto em http://${host}:${port}.`));
  for (const signal of ['SIGINT', 'SIGTERM']) process.once(signal, () => server.close());
}

const entryUrl = process.argv[1] ? pathToFileURL(path.resolve(process.argv[1])).href : '';
if (import.meta.url === entryUrl) runCli().catch((error) => { console.error(`ERRO: ${error.message}`); process.exitCode = 1; });
