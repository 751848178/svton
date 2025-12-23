import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['cjs', 'esm'],
  dts: false,  // 暂时跳过 DTS 构建，因为组件结构需要调整
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
