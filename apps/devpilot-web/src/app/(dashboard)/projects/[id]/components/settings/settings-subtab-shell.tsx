/**
 * 设置子区外壳
 *
 * 单一职责：为六个环境配置子区提供统一的标题/说明 + 专业模块入口链接布局。
 */
'use client';

import React from 'react';
import { PROJECT_COMPACT_ACTION_CLASS } from '../project-workbench-surface';

export function SubtabShell({
  title,
  helper,
  moduleHref,
  moduleLabel,
  actions,
  children,
}: {
  title: string;
  helper: string;
  moduleHref?: string;
  moduleLabel?: string;
  actions?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section
      className="space-y-4"
      data-settings-subtab-layout="flat"
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h3 className="text-sm font-semibold">{title}</h3>
          <p className="mt-1 max-w-[72ch] text-xs leading-5 text-muted-foreground">{helper}</p>
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-2 sm:justify-end">
          {moduleHref && moduleLabel ? (
            <a
              href={moduleHref}
              className={`${PROJECT_COMPACT_ACTION_CLASS} shrink-0 border text-xs text-muted-foreground hover:bg-accent hover:text-foreground`}
            >
              {moduleLabel}
            </a>
          ) : null}
          {actions}
        </div>
      </div>
      <div
        className="min-w-0"
        data-settings-subtab-content="true"
      >
        {children}
      </div>
    </section>
  );
}
