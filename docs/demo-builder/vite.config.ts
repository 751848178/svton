import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  base: '/svton/demos/',
  build: {
    outDir: '../demos',
    emptyOutDir: true,
    rollupOptions: {
      input: 'index.html',
    },
  },
});
