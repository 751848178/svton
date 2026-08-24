/**
 * PX-25：抽屉表格横向滚动容器。
 * 表格收窄后正常应无横向滚动；内容仍溢出时右缘渐隐提示可滚动，
 * 避免「操作列被裁出视口且无提示」（PX-5 的兜底可见性）。
 */
'use client';

import React from 'react';
import type { ReactNode } from 'react';

export function ReleaseScrollTable(props: { children: ReactNode }) {
  return (
    <div className="relative max-w-full">
      <div className="overflow-x-auto rounded-lg border">{props.children}</div>
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-y-0 right-0 w-8 rounded-r-lg bg-gradient-to-l from-border/60 to-transparent"
      />
    </div>
  );
}
