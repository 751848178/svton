/**
 * 页面标题栏
 *
 * 统一列表页的「标题 + 副标题 + 操作区」布局。
 * 替代 25 个页面重复的 `<h1 className="text-2xl font-bold">` + flex action bar。
 *
 * 单一职责：布局组合。无业务逻辑。
 */

import React, { ReactNode } from 'react';

export interface PageHeaderProps {
  title: string;
  description?: ReactNode;
  /** 右侧操作区（按钮、搜索框等）。 */
  actions?: ReactNode;
  className?: string;
}

export function PageHeader(props: PageHeaderProps) {
  const { title, description, actions, className } = props;
  return (
    <div className={`flex flex-wrap items-start justify-between gap-4 ${className ?? ''}`}>
      <div>
        <h1 className="text-2xl font-bold">{title}</h1>
        {description ? <p className="mt-1 text-sm text-muted-foreground">{description}</p> : null}
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-3">{actions}</div> : null}
    </div>
  );
}
