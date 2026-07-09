import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
      // agent-core's compiled dist imports @tauri-apps/api/core, which isn't
      // resolvable in the test environment. Stub it to a no-op invoke so deps
      // that pull it in transitively don't break collection.
      '@tauri-apps/api/core': path.resolve(__dirname, 'test/stubs/tauri-core.ts'),
    },
  },
  test: {
    globals: true,
    environment: 'jsdom',
    include: ['test/**/*.test.{ts,tsx}'],
    // Inline workspace deps so their transitive @tauri-apps/api imports are
    // resolved through the alias above rather than treated as external.
    server: {
      deps: {
        inline: ['@svton/agent-core', '@svton/agent-platform', '@svton/agent-client'],
      },
    },
  },
});
