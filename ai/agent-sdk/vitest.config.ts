import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  resolve: {
    alias: {
      '@tauri-apps/api/core': path.resolve(__dirname, 'test/stubs/tauri-core.ts'),
      '@tauri-apps/api/event': path.resolve(__dirname, 'test/stubs/tauri-event.ts'),
      '@tauri-apps/api/window': path.resolve(__dirname, 'test/stubs/tauri-window.ts'),
    },
  },
  test: {
    globals: true,
    environment: 'node',
    include: ['test/**/*.test.ts'],
    server: {
      deps: {
        inline: ['@svton/agent-core', '@svton/agent-platform'],
      },
    },
  },
});
