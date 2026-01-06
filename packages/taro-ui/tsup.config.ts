import { defineConfig, Options } from 'tsup';
import { sassPlugin } from 'esbuild-sass-plugin';
import postcss from 'postcss';
import autoprefixer from 'autoprefixer';

const sassPluginConfig = sassPlugin({
  async transform(source) {
    const { css } = await postcss([autoprefixer]).process(source, {
      from: undefined,
    });
    return css;
  },
});

const commonExternal = [
  '@tarojs/components',
  '@tarojs/taro',
  'react',
  '@svton/hooks'
];

export default defineConfig([
  // ESM 入口 - 包含组件和自动注入样式
  {
    entry: ['src/index.ts'],
    format: ['esm'],
    outExtension: () => ({ js: '.mjs' }),
    dts: true,
    splitting: false,
    sourcemap: false,
    clean: true,
    external: commonExternal,
    esbuildPlugins: [sassPluginConfig],
    banner: {
      js: `import './index.css';`,
    },
  },
  // CJS 入口 - 包含组件和自动注入样式
  {
    entry: ['src/index.ts'],
    format: ['cjs'],
    outExtension: () => ({ js: '.js' }),
    dts: false,
    splitting: false,
    sourcemap: false,
    clean: false,
    external: commonExternal,
    esbuildPlugins: [sassPluginConfig],
    banner: {
      js: `require('./index.css');`,
    },
  },
  // 纯组件入口 - 不包含样式（供需要自定义样式的用户使用）
  {
    entry: { 'index.pure': 'src/index.ts' },
    format: ['cjs', 'esm'],
    dts: false,
    splitting: false,
    sourcemap: false,
    clean: false,
    external: commonExternal,
    esbuildOptions(options) {
      options.loader = {
        ...options.loader,
        '.scss': 'empty',
      };
    },
  },
  // 样式入口 - 汇总所有组件样式
  {
    entry: { styles: 'src/styles.ts' },
    format: ['cjs', 'esm'],
    dts: false,
    splitting: false,
    sourcemap: false,
    clean: false,
    external: commonExternal,
    esbuildPlugins: [sassPluginConfig],
  },
]);
