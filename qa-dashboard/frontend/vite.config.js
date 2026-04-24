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
    minify: 'terser',
    terserOptions: {
      compress: {
        drop_console: true
      }
    },
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('html2canvas') || id.includes('jspdf')) return 'pdf-export';
          if (id.includes('/docx/')) return 'docx-export';
          if (id.includes('chart.js') || id.includes('react-chartjs-2')) return 'charts';
        }
      }
    }
  }
  };
});
