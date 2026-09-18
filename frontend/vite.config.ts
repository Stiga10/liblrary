import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import path from 'node:path';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: { '@': path.resolve(import.meta.dirname, './src') },
  },
  server: {
    // 5173 is taken by another project on this machine - see CLAUDE.md section 11.
    port: 5174,
    strictPort: true,
    // This is a remote development machine: the browser runs elsewhere, so binding
    // to 127.0.0.1 would make the app unreachable. Set VITE_HOST=127.0.0.1 to
    // restrict it to loopback when working locally.
    host: process.env.VITE_HOST ?? true,
    proxy: {
      // Keeps the browser on one origin in dev, so the session cookie is first-party.
      '/api': { target: 'http://localhost:3000', changeOrigin: true },
      '/uploads': { target: 'http://localhost:3000', changeOrigin: true },
    },
  },
});
