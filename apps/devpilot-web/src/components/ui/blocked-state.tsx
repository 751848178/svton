/**
 * 阻断状态
 *
 * 统一"状态被阻断"的展示：原因 + 恢复动作（Demo callout.danger 风格）。
 * 用于发布单列表失败行等场景；阻断原因与恢复路径一起呈现（AC-UI-013）。
 *
 * 单一职责：渲染阻断原因 + 可选恢复动作。无业务逻辑。
 */

import type { ReactNode } from 'react';
import { WarningCircle } from '@phosphor-icons/react';
import { cn } from '@/lib/utils';

export interface BlockedStateProps {
  /** 阻断标题（可选，默认省略）。 */
  title?: ReactNode;
  /** 阻断原因，必须提供。 */
  reason: ReactNode;
  /** 恢复动作（如 查看发布单 / 重试）。 */
  action?: ReactNode;
  /** 紧凑模式（行内小尺寸）。 */
  compact?: boolean;
  className?: string;
}

export function BlockedState({
  title,
  reason,
  action,
  compact = false,
  className,
}: BlockedStateProps) {
  return (
    <div
      role="alert"
      className={cn(
        'flex flex-col gap-2 rounded-lg border border-red-200 bg-red-50 text-red-700',
        compact ? 'px-3 py-2' : 'p-4',
        className,
      )}
    >
      <div className={cn('flex items-start gap-2', compact ? 'text-xs' : 'text-sm')}>
        <WarningCircle
          size={compact ? 14 : 16}
          weight="fill"
          className="mt-0.5 shrink-0"
          aria-hidden="true"
        />
        <div className="min-w-0">
          {title ? <div className="font-medium">{title}</div> : null}
          <div>{reason}</div>
        </div>
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}
