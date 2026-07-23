'use client';

/**
 * 平台文档中心 — 工作区布局
 *
 * 对标 twgg 的 features/help/help-center-workspace.tsx。
 * 左侧目录（DocsSidebar）+ 右侧正文（DocsViewer）。
 * 当前选中态由本组件持有（无 URL 同步，保持最小实现）。
 *
 * 单一职责：文档中心的两栏布局 + 选中态。不含路由。
 */

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { PageHeader } from '@/components/ui';
import { DEFAULT_DOC_ID } from './docs-registry';
import { DocsSidebar } from './docs-sidebar';
import { DocsViewer } from './docs-viewer';

export function DocsCenterWorkspace() {
  const t = useTranslations('docs');
  const [activeId, setActiveId] = useState<string>(DEFAULT_DOC_ID);

  return (
    <div className="space-y-6">
      <PageHeader title={t('centerTitle')} description={t('centerDescription')} />
      <div className="grid gap-6 md:grid-cols-[220px_minmax(0,1fr)]">
        <aside className="md:sticky md:top-0 md:self-start">
          <DocsSidebar activeId={activeId} onSelect={setActiveId} />
        </aside>
        <div className="min-w-0">
          <DocsViewer documentId={activeId} />
        </div>
      </div>
    </div>
  );
}
