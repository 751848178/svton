import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import tailwindcss from 'tailwindcss';
import autoprefixer from 'autoprefixer';

const host = process.env.TAURI_DEV_HOST;
const posixPathShim = path.resolve(__dirname, 'src/lib/desktop-posix-path.utils.ts');

export default defineConfig(async () => ({
  plugins: [react()],
  css: {
    postcss: {
      plugins: [
        tailwindcss(),
        autoprefixer(),
      ],
    },
  },
  resolve: {
    alias: {
      '@': '/src',
      'path': posixPathShim,
      'node:path': posixPathShim,
      // Resolve @tauri-apps/api from our node_modules (pnpm strict mode fix)
      '@tauri-apps/api': path.resolve(__dirname, 'node_modules/@tauri-apps/api'),
    },
    dedupe: ['react', 'react-dom'],
  },
  clearScreen: false,
  server: {
    port: 1420,
    strictPort: true,
    host: host || false,
    hmr: host
      ? {
          protocol: 'ws',
          host,
          port: 1421,
        }
      : undefined,
    watch: {
      ignored: ['**/src-tauri/**'],
    },
  },
  build: {
    rollupOptions: {
      // Remaining server-only built-ins stay external; path is browser-shimmed.
      external: ['node:fs', 'fs', 'node:os', 'os', 'node:child_process', 'child_process'],
      output: {
        manualChunks(id) {
          if (id.includes('node_modules')) {
            if (id.includes('/@tauri-apps/')) return 'tauri';
            if (id.includes('/react/') || id.includes('/react-dom/') || id.includes('/scheduler/')) {
              return 'react';
            }
            return 'vendor';
          }
          if (id.includes('/ai/agent-core/') || id.includes('/ai/agent-client/')) {
            return 'agent-runtime';
          }
          if (id.includes('/packages/agent-ui/')) {
            return 'agent-ui';
          }
        },
      },
    },
  },
}));
