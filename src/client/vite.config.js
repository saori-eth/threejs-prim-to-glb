import { defineConfig } from 'vite';

export default defineConfig({
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
