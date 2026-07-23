import { DocsCenterWorkspace } from '@/features/docs/docs-center-workspace';

/**
 * 平台文档中心 — /docs 路由
 *
 * 对标 twgg 的 (console)/help/page.tsx。
 * 纯客户端交互（左侧目录切换），无服务端取数，故直接渲染工作区组件。
 *
 * 单一职责：路由入口。
 */
export default function DocsPage() {
  return <DocsCenterWorkspace />;
}
