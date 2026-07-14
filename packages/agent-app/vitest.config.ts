import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  resolve: {
    dedupe: ['react', 'react-dom'],
    alias: {
      react: path.resolve(__dirname, 'node_modules/react'),
      'react/jsx-runtime': path.resolve(__dirname, 'node_modules/react/jsx-runtime.js'),
      'react/jsx-dev-runtime': path.resolve(__dirname, 'node_modules/react/jsx-dev-runtime.js'),
      'react-dom': path.resolve(__dirname, 'node_modules/react-dom'),
      '@svton/agent-core': path.resolve(__dirname, '../../ai/agent-core/src/index.ts'),
      '@svton/agent-client': path.resolve(__dirname, '../../ai/agent-client/src/index.ts'),
      '@svton/agent-platform': path.resolve(__dirname, '../../ai/agent-platform/src/index.ts'),
      '@svton/agent-ui': path.resolve(__dirname, '../../packages/agent-ui/src/index.ts'),
      '@svton/service': path.resolve(__dirname, '../../packages/service/src/index.ts'),
      '@svton/api-client/abort': path.resolve(__dirname, '../../packages/api-client/src/abort.ts'),
      '@svton/api-client': path.resolve(__dirname, '../../packages/api-client/src/index.ts'),
      '@svton/ui': path.resolve(__dirname, '../../packages/ui/src/index.ts'),
      '@svton/hooks': path.resolve(__dirname, '../../packages/hooks/src/index.ts'),
      '@tauri-apps/api/core': path.resolve(__dirname, 'test/stubs/tauri-core.ts'),
    },
  },
  test: {
    globals: true,
    environment: 'jsdom',
    include: ['test/**/*.test.{ts,tsx}'],
    server: {
      deps: {
        inline: ['@svton/agent-core', '@svton/agent-platform', '@svton/agent-client'],
      },
    },
  },
});
