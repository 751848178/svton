import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['cjs', 'esm'],
  dts: true,
  splitting: false,
  sourcemap: false,
  clean: true,
  skipNodeModulesBundle: true,
  external: [
    '@nestjs/common',
    '@nestjs/core',
    'bullmq',
    'reflect-metadata',
    'rxjs',
  ],
});
