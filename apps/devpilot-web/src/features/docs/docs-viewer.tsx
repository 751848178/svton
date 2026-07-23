'use client';

/**
 * 平台文档中心 — 单文档查看器
 *
 * 对标 twgg 的 features/help/help-document-viewer.tsx。
 * 同时被两处复用：
 *  1. in-page 帮助弹窗（execution-policies 页的「使用说明」）。
 *  2. /docs 平台级页面（左侧目录点选后右侧渲染）。
 *
 * `compact=true`（弹窗用）时不渲染标题卡，仅渲染正文。
 *
 * 单一职责：按 documentId 渲染一篇文档。无状态、无数据获取。
 */

import { useTranslations } from 'next-intl';
import { cn } from '@/lib/utils';
import { findDocsDocument, DEFAULT_DOC_ID } from './docs-registry';

/** 待补充内容的文档 id（正文为空的占位条目）。 */
const PENDING_DOC_IDS = new Set([DEFAULT_DOC_ID]);

export interface DocsViewerProps {
  /** 文档 id；找不到时回退到 overview。 */
  documentId: string;
  /** 紧凑模式：弹窗里用，不渲染标题卡。默认 false。 */
  compact?: boolean;
  className?: string;
}

export function DocsViewer({ documentId, compact = false, className }: DocsViewerProps) {
  const t = useTranslations('docs');
  const doc = findDocsDocument(documentId) ?? findDocsDocument(DEFAULT_DOC_ID);

  if (!doc) {
    return <div className={cn('text-sm text-muted-foreground', className)}>{t('notFound')}</div>;
  }

  const Content = doc.Content;
  const isPending = PENDING_DOC_IDS.has(doc.id);

  return (
    <div className={cn('space-y-4', className)}>
      {!compact && (
        <header className="space-y-1 border-b pb-3">
          <h1 className="text-xl font-bold">{t(doc.titleKey)}</h1>
          {doc.description ? (
            <p className="text-sm text-muted-foreground">{doc.description}</p>
          ) : null}
        </header>
      )}
      {isPending ? (
        <div className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">
          {t('pending')}
        </div>
      ) : (
        <Content />
      )}
    </div>
  );
}
