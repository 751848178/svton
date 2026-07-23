'use client';

/**
 * 平台文档中心 — 左侧目录
 *
 * 对标 twgg 的 help-center-workspace 左侧目录部分。
 * 渲染分组 + 文档条目，点击切换当前文档。
 *
 * 单一职责：目录列表 + 选中态高亮。无数据获取。
 */

import { useTranslations } from 'next-intl';
import { cn } from '@/lib/utils';
import { docsGroups } from './docs-registry';

export interface DocsSidebarProps {
  /** 当前选中文档 id。 */
  activeId: string;
  /** 切换文档回调。 */
  onSelect: (id: string) => void;
  className?: string;
}

export function DocsSidebar({ activeId, onSelect, className }: DocsSidebarProps) {
  const t = useTranslations('docs');

  return (
    <nav className={cn('space-y-5', className)} aria-label={t('sidebarLabel')}>
      {docsGroups.map((group) => (
        <div key={group.titleKey} className="space-y-1.5">
          <h2 className="px-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            {t(group.titleKey)}
          </h2>
          <ul className="space-y-0.5">
            {group.items.map((doc) => {
              const active = doc.id === activeId;
              return (
                <li key={doc.id}>
                  <button
                    type="button"
                    onClick={() => onSelect(doc.id)}
                    className={cn(
                      'w-full rounded-md px-2 py-1.5 text-left text-sm transition-colors',
                      active
                        ? 'bg-primary/10 font-medium text-primary'
                        : 'text-foreground/80 hover:bg-accent hover:text-accent-foreground',
                    )}
                  >
                    {t(doc.titleKey)}
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );
}
