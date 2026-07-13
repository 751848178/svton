import { defineConfig } from 'vitest/config';

export default defineConfig({
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
