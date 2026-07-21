import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  resolve: {
    alias: {
      // agent-core's compiled dist imports @tauri-apps/api/core transitively;
      // useSession imports @tauri-apps/api/window for onCloseRequested.
      // Neither is resolvable in the test environment — stub them.
      '@tauri-apps/api/core': path.resolve(__dirname, 'test/stubs/tauri-core.ts'),
      '@tauri-apps/api/event': path.resolve(__dirname, 'test/stubs/tauri-event.ts'),
      '@tauri-apps/api/window': path.resolve(__dirname, 'test/stubs/tauri-window.ts'),
    },
  },
  test: {
    globals: true,
    environment: 'jsdom',
    include: ['test/**/*.test.{ts,tsx}'],
    setupFiles: [],
    server: {
      deps: {
        inline: ['@svton/agent-core', '@svton/agent-platform'],
      },
    },
  },
});
