/**
 * 设置子区外壳
 *
 * 单一职责：为五个环境配置子区提供统一的标题/说明 + 专业模块入口链接布局。
 */
'use client';

import React from 'react';

export function SubtabShell({
  title,
  helper,
  moduleHref,
  moduleLabel,
  children,
}: {
  title: string;
  helper: string;
  moduleHref: string;
  moduleLabel: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold">{title}</h3>
          <p className="mt-1 text-xs text-muted-foreground">{helper}</p>
        </div>
        <a
          href={moduleHref}
          className="shrink-0 rounded-md border px-2.5 py-1 text-xs text-muted-foreground hover:bg-accent hover:text-foreground"
        >
          {moduleLabel}
        </a>
      </div>
      <div className="rounded-lg border p-3">{children}</div>
    </section>
  );
}
