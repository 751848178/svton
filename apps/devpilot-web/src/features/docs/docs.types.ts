/**
 * 平台文档中心 — 类型定义
 *
 * 对标 twgg 的 features/help/help-docs.types.ts。
 * 文档内容以结构化 JSX 内联（content），而非 markdown 文本，
 * 因此不引入 markdown 渲染依赖。
 *
 * 单一职责：纯类型，无运行时。
 */

import type { ComponentType } from 'react';

/**
 * 单篇文档。
 *
 * - `id`：稳定标识，用于路由 / 弹窗传参 / registry 查找。
 * - `titleKey`：标题的 i18n 键（走 `docs` 命名空间下的文档条目）。
 * - `description`：目录里的副标题（中文内联即可，本平台文档主体为中文）。
 * - `Content`：文档正文组件（TSX），由各 doc-content-*.tsx 导出。
 * - `tags`：可选标签，便于后续检索。
 */
export interface DocsDocument {
  id: string;
  titleKey: string;
  description: string;
  Content: ComponentType;
  tags?: string[];
}

/**
 * 文档分组（左侧目录的一节）。
 *
 * - `titleKey`：分组标题的 i18n 键（走 `docs` 命名空间的 `section*`）。
 * - `items`：该分组下的文档列表。
 */
export interface DocsGroup {
  titleKey: string;
  items: DocsDocument[];
}
