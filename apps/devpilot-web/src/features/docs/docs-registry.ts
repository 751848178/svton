/**
 * 平台文档中心 — 文档注册表
 *
 * 对标 twgg 的 features/help/help-docs.registry.ts。
 * 分组目录 + 文档条目，含查找函数。
 *
 * 本期只填「执行策略」一篇正式文档；其余占位条目留空 Content，
 * 在 viewer 里回退为「待补充」提示，保证 /docs 不空、骨架可扩展。
 *
 * 单一职责：文档元数据目录 + 查找。不含渲染。
 */

import type { DocsDocument, DocsGroup } from './docs.types';
import { DocsContentExecutionPolicy } from './docs-content-execution-policy';

/**
 * 执行策略文档（本期唯一正式文档）。
 * titleKey 走 docs 命名空间：docs.titles.executionPolicies。
 */
const EXECUTION_POLICY_DOC: DocsDocument = {
  id: 'execution-policies',
  titleKey: 'titles.executionPolicies',
  description: '服务器命令的白名单 / 黑名单模板',
  Content: DocsContentExecutionPolicy,
  tags: ['服务器执行', '命令策略', '安全'],
};

/**
 * 平台总览（占位）。
 * 让 /docs 首屏有内容、左侧目录不空；正文待后续补。
 */
const OVERVIEW_DOC: DocsDocument = {
  id: 'overview',
  titleKey: 'titles.overview',
  description: '平台总览（待补充）',
  Content: () => null,
};

/**
 * 文档分组目录。
 * 分组标题走 docs 命名空间的 section* 键。
 */
export const docsGroups: DocsGroup[] = [
  {
    titleKey: 'sectionGettingStarted',
    items: [OVERVIEW_DOC],
  },
  {
    titleKey: 'sectionServerExecution',
    items: [EXECUTION_POLICY_DOC],
  },
];

/** 所有文档的扁平列表（便于按 id 查找）。 */
const allDocs: DocsDocument[] = docsGroups.flatMap((g) => g.items);

/**
 * 按 id 查找文档。找不到返回 null（调用方负责回退到 overview）。
 */
export function findDocsDocument(id: string): DocsDocument | null {
  return allDocs.find((doc) => doc.id === id) ?? null;
}

/** 默认文档 id（无选中 / 查找失败时回退）。 */
export const DEFAULT_DOC_ID = 'overview';
