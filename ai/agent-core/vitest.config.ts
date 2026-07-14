import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  resolve: {
    alias: {
      '@svton/agent-core': path.resolve(__dirname, 'src/index.ts'),
      '@svton/agent-platform': path.resolve(__dirname, '../agent-platform/src/index.ts'),
    },
  },
  test: {
    globals: true,
    environment: 'node',
    include: ['test/**/*.test.ts'],
  },
});
