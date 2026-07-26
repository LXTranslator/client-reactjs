import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

/**
 * Vite configuration.
 *
 * The dev server proxies `/api` to the Express backend so the browser sees a
 * single origin during development. That keeps cross origin rules out of the
 * development path entirely; production deploys the built assets behind a
 * reverse proxy that does the same thing.
 */
export default defineConfig({
  plugins: [react()],

  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: process.env.VITE_API_PROXY_TARGET ?? 'http://localhost:4000',
        changeOrigin: true,
      },
    },
  },

  build: {
    outDir: 'dist',
    // Source maps are omitted from production output so the original sources
    // are not published alongside the bundle.
    sourcemap: false,
    target: 'es2022',
  },

  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./tests/setup.js'],
    include: ['tests/**/*.test.{js,jsx}'],
    coverage: {
      include: ['src/**/*.{js,jsx}'],
      exclude: ['src/main.jsx'],
    },
  },
});
