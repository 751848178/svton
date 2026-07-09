import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['cjs', 'esm'],
  dts: true,
  splitting: false,
  sourcemap: true,
  clean: true,
  // @tauri-apps/api is only available in the desktop app (not in agent-core's
  // own deps). The dynamic import is kept as a runtime fallback for legacy
  // paths; marking it external stops esbuild from trying to resolve it at
  // bundle time.
  external: ['@tauri-apps/api/core'],
});
