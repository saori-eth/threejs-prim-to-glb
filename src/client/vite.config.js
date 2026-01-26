import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  root: '.',
  build: {
    outDir: '../../dist/client',
    emptyOutDir: true,
  },
  server: {
    proxy: {
      '/generate-scene': 'http://localhost:3080',
      '/refine-scene': 'http://localhost:3080',
      '/healthz': 'http://localhost:3080',
    },
  },
});
