/**
 * Configuration Vite pour Testmo Dashboard
 * Build tool moderne et performant (LEAN principles)
 */

import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const backendUrl = env.BACKEND_URL || 'http://localhost:3001';

  return {
  plugins: [react()],
  server: {
    port: 3000,
    proxy: {
      // Proxy vers le backend — configurable via BACKEND_URL dans .env
      '/api': {
        target: backendUrl,
        changeOrigin: true
      }
    }
  },
  build: {
    outDir: 'dist',
    sourcemap: true,
    // Optimisation LEAN
    minify: 'terser',
    terserOptions: {
      compress: {
        drop_console: true
      }
    }
  }
  };
});
