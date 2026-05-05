import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const devHost = process.env.SNAPFLOW_DEV_HOST || '127.0.0.1';
const allowedHosts = (process.env.SNAPFLOW_ALLOWED_HOSTS || '')
  .split(',')
  .map((host) => host.trim())
  .filter(Boolean);
const hostAllowList = allowedHosts.length ? { allowedHosts } : {};

export default defineConfig({
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
    port: 5173,
    ...hostAllowList,
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:3000',
        changeOrigin: true,
      },
      '/uploads': {
        target: 'http://127.0.0.1:3000',
        changeOrigin: true,
      },
    },
  },
  preview: {
    host: devHost,
    port: 4173,
    ...hostAllowList,
  },
});
