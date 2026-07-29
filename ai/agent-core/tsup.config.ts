import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['cjs', 'esm'],
  dts: true,
  splitting: false,
  sourcemap: true,
  clean: true,
  // @tauri-apps/api is only available in the desktop app (not in agent-core's
  // own deps). The dynamic import remains a desktop runtime fallback; marking
  // it external stops esbuild from trying to resolve it at bundle time.
  external: ['@tauri-apps/api/core'],
});
