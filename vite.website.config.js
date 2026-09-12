import path from 'node:path';
import { defineConfig, loadEnv } from 'vite';
import { configureApiProxy, resolveApiProxyTarget } from './vite.config.js';
import { assertDistinctPorts } from './scripts/snapflow-startup.mjs';

export function websiteServerOptions(env, backend = {}) {
  const [apiPort, , websitePort] = assertDistinctPorts([backend.PORT || env.SNAPFLOW_API_PORT || 3000,
    env.SNAPFLOW_DEV_PORT || 5173, env.SNAPFLOW_WEBSITE_PORT || 5174]);
  const target = resolveApiProxyTarget({ SNAPFLOW_API_PORT: apiPort });
  return { host: env.SNAPFLOW_WEBSITE_HOST || '127.0.0.1', port: websitePort, strictPort: true,
    allowedHosts: (env.SNAPFLOW_ALLOWED_HOSTS || '').split(',').map((host) => host.trim()).filter(Boolean),
    proxy: { '/api': { target, changeOrigin: true, configure: configureApiProxy } } };
}

export default defineConfig(({ mode }) => {
  const root = process.cwd();
  const env = { ...loadEnv(mode, root, ''), ...process.env };
  const backend = loadEnv(mode, path.join(root, 'backend'), '');
  return {
    root: path.join(root, 'website'),
    server: websiteServerOptions(env, backend),
    build: { outDir: path.join(root, 'dist', 'website'), emptyOutDir: true,
      rollupOptions: { input: { main: path.join(root, 'website/index.html'), about: path.join(root, 'website/sobre.html') } } },
  };
});
