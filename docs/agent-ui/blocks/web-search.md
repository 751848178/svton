# WebSearchBlockView

> 用于展示 Agent 执行网络搜索后的查询语句与结果列表的块组件。

## 何时使用

当 Agent 调用网络搜索工具并返回结果时，使用 `WebSearchBlockView` 在会话流中嵌入搜索结果卡片，展示查询关键词与命中的网页列表。该组件适合需要引用外部资料的问答、事实核查、技术调研等场景。

## 快速开始

```tsx
import { WebSearchBlockView } from '@svton/agent-ui';

<WebSearchBlockView
  query="VitePress 自定义主题"
  results={[
    {
      title: 'VitePress 官方文档',
      url: 'https://vitepress.dev',
      snippet: 'VitePress 是基于 Vite 的静态站点生成器...',
    },
  ]}
/>
```

<Demo name="web-search" :height="360" />

## API

| Prop | 类型 | 必填 | 说明 |
|------|------|------|------|
| `query` | `string` | 是 | 搜索查询语句 |
| `results` | `SearchResult[]` | 是 | 搜索结果条目数组 |
| `className` | `string` | 否 | 自定义 CSS 类名 |

```ts
interface SearchResult {
  /** 结果页标题 */
  title: string;
  /** 结果页 URL */
  url: string;
  /** 可选的摘要片段 */
  snippet?: string;
}
```

## 进阶示例

展示多条搜索结果：

```tsx
<WebSearchBlockView
  query="TypeScript 5.0 新特性"
  results={[
    { title: 'TypeScript 5.0 Release Notes', url: 'https://devblogs.microsoft.com/typescript/announcing-typescript-5-0/' },
    { title: 'TypeScript Handbook', url: 'https://www.typescriptlang.org/docs/handbook/', snippet: '官方手册' },
  ]}
  className="search-results"
/>
```

## 注意事项

- `snippet` 为可选字段；部分搜索引擎可能不返回摘要，此时组件仅展示标题与 URL。
- 组件本身不会发起网络请求，`results` 数据需由调用方通过搜索工具获取后传入。
- URL 会在组件内渲染为可点击链接，点击后在新标签页打开。
