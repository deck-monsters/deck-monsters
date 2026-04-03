import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
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
});
