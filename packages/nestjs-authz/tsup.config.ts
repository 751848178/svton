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
    '@svton/authz',
    '@nestjs/common',
    '@nestjs/core',
    'reflect-metadata',
    'rxjs',
  ],
});
