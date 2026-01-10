import { defineConfig } from 'tsup';

export default defineConfig({
  entry: {
    index: 'src/index.ts',
    'core/index': 'src/core/index.ts',
    'nestjs/index': 'src/nestjs/index.ts',
    'prisma/index': 'src/prisma/index.ts',
    'react/index': 'src/react/index.ts',
  },
  format: ['cjs', 'esm'],
  dts: true,
  splitting: false,
  sourcemap: true,
  clean: true,
  external: [
    'react',
    '@nestjs/common',
    '@nestjs/core',
    '@prisma/client',
    'ioredis',
  ],
});
