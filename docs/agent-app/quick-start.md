# 快速开始

::: tip 🚀 不想安装？先在线体验
[**点击这里 →**](/agent-app-demo/) 输入 API Key 即可在浏览器中直接体验，无需创建项目。
:::

## 环境要求

- Node.js >= 18
- React >= 18
- 一个 LLM API Key（OpenAI 或 Anthropic）

## 1. 创建项目

```bash
# 使用 Vite
npm create vite@latest my-agent -- --template react-ts
cd my-agent
npm install @svton/agent-app reflect-metadata
```

## 2. 配置 tsconfig.json

确保 `experimentalDecorators` 已启用：

```json
{
  "compilerOptions": {
    "experimentalDecorators": true,
    "emitDecoratorMetadata": true
  }
}
```

## 3. 使用 AgentApp

替换 `src/App.tsx`：

```tsx
import 'reflect-metadata';
import { AgentApp } from '@svton/agent-app';

export default function App() {
  return (
    <AgentApp
      providers={[{
        type: 'openai',
        apiKey: import.meta.env.VITE_OPENAI_API_KEY,
        models: [
          { id: 'gpt-4o', name: 'GPT-4o' },
          { id: 'gpt-4o-mini', name: 'GPT-4o Mini' },
        ],
      }]}
    />
  );
}
```

## 4. 配置 API Key

创建 `.env.local`：

```bash
VITE_OPENAI_API_KEY=sk-your-key-here
```

## 5. 启动

```bash
npm run dev
```

打开 `http://localhost:5173`，你会看到一个完整的 AI Agent 应用。

## Next.js 集成

对于 Next.js 项目，需要使用动态导入避免 SSR 问题：

```tsx
// app/page.tsx
'use client';

import dynamic from 'next/dynamic';

const AgentApp = dynamic(
  () => import('@svton/agent-app').then(m => m.AgentApp),
  { ssr: false }
);

export default function Page() {
  return (
    <AgentApp
      providers={[{
        type: 'openai',
        apiKey: process.env.NEXT_PUBLIC_OPENAI_API_KEY!,
        models: [{ id: 'gpt-4o', name: 'GPT-4o' }],
      }]}
    />
  );
}
```

## 添加 Tailwind CSS（推荐）

AgentApp 使用 Tailwind 类名。确保你的项目已配置 Tailwind：

```bash
npm install -D tailwindcss postcss autoprefixer
npx tailwindcss init -p
```

```js
// tailwind.config.js
export default {
  content: [
    './src/**/*.{html,js,ts,jsx,tsx}',
    './node_modules/@svton/agent-app/dist/**/*.js',
    './node_modules/@svton/agent-ui/dist/**/*.js',
  ],
  theme: { extend: {} },
  plugins: [],
};
```

## 样式引入

AgentApp 的 CSS 已打包在 dist 中，无需额外引入。如果你使用 Tailwind，确保 content 路径包含 `@svton/agent-app` 和 `@svton/agent-ui`。
