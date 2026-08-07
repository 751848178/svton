/**
 * 空状态
 *
 * 统一空数据展示：Demo `.empty` 风格（虚线框 + 居中文本 + 可选下一动作）。
 * 替代三个步骤壳（构建/预发/生产）与发布单列表里重复的内联空态 `<p>`。
 *
 * 单一职责：渲染空态文本 + 可选描述 + 可选下一动作。无业务逻辑。
 */

import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

export interface EmptyStateProps {
  /** 主文本。 */
  title?: ReactNode;
  /** 补充说明（可选）。 */
  description?: ReactNode;
  /** 明确的下一动作（如 创建发布单 / 构建最新代码）。 */
  action?: ReactNode;
  /** 是否带虚线边框，默认 true。 */
  dashed?: boolean;
  className?: string;
}

export function EmptyState({
  title = '暂无数据',
  description,
  action,
  dashed = true,
  className,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        'flex flex-col items-center gap-2 px-6 py-10 text-center',
        dashed && 'rounded-lg border border-dashed',
        className,
      )}
    >
      <div className="text-sm text-muted-foreground">{title}</div>
      {description ? <div className="text-xs text-muted-foreground/80">{description}</div> : null}
      {action ? <div className="mt-2">{action}</div> : null}
    </div>
  );
}
