import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export function resolveApiProxyTarget(env = {}) {
  return `http://127.0.0.1:${Number(env.SNAPFLOW_API_PORT) || 3000}`;
}

export function configureApiProxy(proxy) {
  proxy.on('error', (error, request, response) => {
    if (!response || !('writeHead' in response) || response.headersSent || response.writableEnded) return;
    response.writeHead(503, { 'Content-Type': 'application/json; charset=utf-8' });
    response.end(JSON.stringify({
      error: 'A API do SnapFlow está iniciando ou temporariamente indisponível. O painel continuará tentando.',
      code: 'api_unavailable',
    }));
  });
}

function proxyOptions(target) {
  return {
    target,
    changeOrigin: true,
    configure: configureApiProxy,
  };
}

export default defineConfig(({ mode }) => {
  const env = { ...loadEnv(mode, process.cwd(), ''), ...process.env };
  const devHost = env.SNAPFLOW_DEV_HOST || '127.0.0.1';
  const devPort = Number(env.SNAPFLOW_DEV_PORT) || 5173;
  const apiProxyTarget = resolveApiProxyTarget(env);
  const allowedHosts = (env.SNAPFLOW_ALLOWED_HOSTS || '')
    .split(',')
    .map((host) => host.trim())
    .filter(Boolean);
  const hostAllowList = allowedHosts.length ? { allowedHosts } : {};

  return {
    plugins: [react()],
    test: {
      environment: 'jsdom',
      environmentOptions: {
        jsdom: {
          url: 'http://localhost:3000/',
        },
      },
      include: ['src/**/*.{test,spec}.{js,jsx}'],
      setupFiles: './src/test/setup.js',
    },
    server: {
      host: devHost,
      port: devPort,
      strictPort: true,
      ...hostAllowList,
      proxy: {
        '/api': proxyOptions(apiProxyTarget),
        '/uploads': proxyOptions(apiProxyTarget),
      },
    },
    preview: {
      host: devHost,
      port: 4173,
      strictPort: true,
      ...hostAllowList,
    },
  };
});
