/**
 * 折叠分组容器
 *
 * 单一职责:把同域的指标卡组收进可折叠区域,标题行展示组内异常计数徽章。
 * 默认折叠;组内出现异常时自动展开一次(用户手动折叠后不强制再开)。
 */

'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { useTranslations } from 'next-intl';

interface CollapsibleGroupProps {
  title: string;
  /** 组内需要人工处理的异常数,>0 时展示红色徽章并默认展开。 */
  issueCount?: number;
  children: ReactNode;
}

export function CollapsibleGroup({ title, issueCount = 0, children }: CollapsibleGroupProps) {
  const t = useTranslations('executionGovernance');
  const [open, setOpen] = useState(false);
  const hasIssues = issueCount > 0;

  useEffect(() => {
    if (hasIssues) setOpen(true);
  }, [hasIssues]);

  return (
    <div className="rounded-lg border">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        className="flex min-h-11 w-full items-center justify-between gap-3 px-4 text-left hover:bg-accent/50"
      >
        <span className="flex min-w-0 items-center gap-2">
          <span
            aria-hidden
            className={`inline-block text-muted-foreground transition-transform ${open ? 'rotate-90' : ''}`}
          >
            ›
          </span>
          <span className="truncate text-sm font-medium">{title}</span>
          {hasIssues ? (
            <span className="shrink-0 rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700">
              {issueCount}
            </span>
          ) : null}
        </span>
        <span className="shrink-0 text-xs text-muted-foreground">
          {open ? t('collapse') : t('expand')}
        </span>
      </button>
      {open ? <div className="border-t p-4">{children}</div> : null}
    </div>
  );
}
