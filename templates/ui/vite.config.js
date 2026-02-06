import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  build: {
    outDir: 'dist',
    sourcemap: false
  },
  server: {
    proxy: {
      '/api': 'http://localhost:3847',
      '/health': 'http://localhost:3847',
      '/ws': {
        target: 'ws://localhost:3847',
        ws: true
      }
    }
  }
});
