import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['cjs', 'esm'],
  dts: true, // 生成 DTS 类型声明文件
  splitting: false,
  sourcemap: false,
  clean: true,
  external: [
    '@tarojs/components',
    '@tarojs/taro',
    'react',
    '@svton/hooks'
  ],
  esbuildOptions(options) {
    options.loader = {
      ...options.loader,
      '.scss': 'empty',
    };
  },
});
