import { defineConfig } from 'vite';
export default defineConfig({
  build: { target: 'es2022' },
  optimizeDeps: { exclude: ['@ffmpeg/ffmpeg', '@ffmpeg/util'] },
  worker: { format: 'es' },
});
