/// <reference types="vitest" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      // Resolve engine to a browser-safe entry that only exports pure-data
      // modules (COMMAND_CATALOG etc.) with no Node.js dependencies.
      // The full engine (Node-only) is never bundled into the web client.
      '@deck-monsters/engine': path.resolve(__dirname, '../../packages/engine/src/browser.ts'),
    },
  },
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
