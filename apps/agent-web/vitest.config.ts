import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';

/**
 * Vitest config for agent-web (PI008).
 *
 * Mirrors agent-desktop/vitest.config.ts: inlines the workspace packages so
 * their transitive imports resolve through the aliases below, and stubs
 * @tauri-apps/api (pulled in transitively by agent-core's compiled dist) so
 * collection does not break in the jsdom test environment.
 *
 * Next.js owns the `next build` step (see package.json `build`); vitest only
 * runs the pure-logic modules under src/lib (the migration seams).
 */
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@svton/agent-core': path.resolve(__dirname, '../../ai/agent-core/src/index.ts'),
      '@svton/agent-client': path.resolve(__dirname, '../../ai/agent-client/src/index.ts'),
      '@svton/agent-platform': path.resolve(__dirname, '../../ai/agent-platform/src/index.ts'),
      '@svton/agent-ui': path.resolve(__dirname, '../../packages/agent-ui/src/index.ts'),
      '@svton/ui/i18n': path.resolve(__dirname, '../../packages/ui/src/i18n/server.ts'),
      '@svton/ui': path.resolve(__dirname, '../../packages/ui/src/index.ts'),
      'svton-web-locale-host': path.resolve(__dirname, 'src/lib/locale/web-locale-host.ts'),
      '@': path.resolve(__dirname, 'src'),
      // agent-core's compiled dist imports @tauri-apps/api/core, which isn't
      // resolvable in the test environment. Stub it to a no-op invoke so deps
      // that pull it in transitively don't break collection.
      '@tauri-apps/api/core': path.resolve(__dirname, 'test/stubs/tauri-core.ts'),
      '@tauri-apps/api/event': path.resolve(__dirname, 'test/stubs/tauri-event.ts'),
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
