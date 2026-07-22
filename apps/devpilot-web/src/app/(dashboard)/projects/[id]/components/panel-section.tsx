/**
 * 项目详情页 - 区块包装
 *
 * 单一职责：为项目详情页的 panel 组提供「标题 + 一句话说明」的小节头，
 * 并用顶部边框做视觉分组。不承载业务逻辑、不关心具体 panel 内容。
 *
 * 用于解决审计 P0-1：原 5 个 panel 平铺无分组、无说明，非开发者看不懂。
 */

import { ReactNode } from 'react';

export interface PanelSectionProps {
  /** 区块标题（已本地化）。 */
  title: string;
  /** 区块一句话说明（已本地化）。 */
  description?: string;
  children: ReactNode;
  className?: string;
}

/** 渲染带说明的小节头 + 内容。首组无上边框，后续组顶部 border-t 分隔。 */
export function PanelSection({ title, description, children, className }: PanelSectionProps) {
  return (
    <section className={`space-y-4 pt-2 ${className ?? ''}`}>
      <div>
        <h2 className="text-lg font-semibold">{title}</h2>
        {description ? (
          <p className="mt-1 text-sm text-muted-foreground">{description}</p>
        ) : null}
      </div>
      <div className="space-y-4">{children}</div>
    </section>
  );
}
