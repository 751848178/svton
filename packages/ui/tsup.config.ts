import { defineConfig } from 'tsup';

/**
 * tsup 构建配置
 *
 * 关键：在产物顶部注入 `'use client'` 指令。
 * 原因：@svton/ui 是混合包——既含纯展示组件（Card/Tag/Divider），也含使用 hooks 的
 * 交互组件（Modal/Portal/Copyable/Tooltip…）。Next.js App Router 要求：凡是含 React hooks
 * 的模块，被 Server Component 直接 import 时必须带 `'use client'`，否则编译报错。
 *
 * 采用「整包 client」是社区对混合 UI 包的标准做法（与 shadcn/ui 一致）。代价：在 Server
 * Component 中 import 本包的任一组件会形成一个 client 边界——但展示型组件在 client 渲染
 * 行为完全一致，不影响首屏（它们仍随 server HTML 流式返回）。
 */
export default defineConfig({
  entry: ['src/index.ts'],
  format: ['cjs', 'esm'],
  dts: true,
  banner: {
    js: "'use client';",
  },
});
