import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [
    react({
      include: ['**/*.{js,jsx,ts,tsx}'],
      exclude: /node_modules/,
      jsxRuntime: 'automatic',
    }),
  ],
  optimizeDeps: {
    esbuildOptions: {
      jsx: 'automatic',
    },
  },
  server: {
    port: 5173,
    host: '0.0.0.0',
    strictPort: false,
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
    },
  },
  build: {
    outDir: 'dist',
    sourcemap: true,
  },
});
