import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  resolve: {
    alias: {
      '@tauri-apps/api/core': path.resolve(__dirname, 'test/stubs/tauri-core.ts'),
    },
  },
  test: {
    globals: true,
    environment: 'node',
    include: ['test/**/*.test.{ts,tsx}'],
    server: {
      deps: {
        inline: ['@svton/agent-core', '@svton/agent-platform', '@svton/agent-client'],
      },
    },
  },
});
