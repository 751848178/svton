/**
 * PanelGroup —— 项目详情页 panel 统一外壳容器。
 *
 * 单一职责：渲染「标题 + 灰字小号副标题 + 内容区」的圆角边框容器，
 * 替换此前散落在各 panel 里的裸 `<div className="rounded-lg border p-4">` +
 * `<h3>` + `<p>` 三段重复结构。
 *
 * 仅做布局编排，不承载业务逻辑；标题/副标题均由调用方从 i18n 传入。
 */
'use client';

import type { ReactNode } from 'react';

export interface PanelGroupProps {
  /** 区块主标题（通常为 panel 名，如「关联应用」）。 */
  title: ReactNode;
  /** 区块副标题（灰字小号说明，回答"这区块是干什么的"）。 */
  subtitle?: ReactNode;
  /** 标题前的图标（可选）。 */
  icon?: ReactNode;
  /** 标题行右侧的操作区（如「新建」按钮），与标题/副标题垂直对齐。 */
  actions?: ReactNode;
  /** 区块内容。 */
  children: ReactNode;
  /** 透传到容器的额外 className。 */
  className?: string;
}

export function PanelGroup({ title, subtitle, icon, actions, children, className }: PanelGroupProps) {
  return (
    <div className={`rounded-lg border p-4 ${className ?? ''}`.trim()}>
      <div className="mb-3 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            {icon ? <span className="text-muted-foreground">{icon}</span> : null}
            <h3 className="text-base font-semibold">{title}</h3>
          </div>
          {subtitle ? (
            <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>
          ) : null}
        </div>
        {actions ? <div className="shrink-0">{actions}</div> : null}
      </div>
      {children}
    </div>
  );
}
