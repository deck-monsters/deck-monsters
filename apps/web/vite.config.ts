/// <reference types="vitest" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  define: {
    'import.meta.env.VITE_BUILD_VERSION': JSON.stringify(
      process.env['BUILD_VERSION'] ?? 'dev'
    ),
  },
  server: {
    port: 5173,
    proxy: {
      '/trpc': {
        target: process.env['VITE_SERVER_URL'] ?? 'http://localhost:3000',
        changeOrigin: true,
        ws: true,
      },
    },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: './src/test-setup.ts',
  },
});
