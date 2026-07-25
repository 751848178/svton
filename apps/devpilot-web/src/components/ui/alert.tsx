/**
 * 提示信息横幅
 *
 * 与 ErrorBanner 配套的非错误态提示：用于「普通用户误入管理员视图」等
 * 需要解释上下文、并可选提供跳转链接的场景。单一职责：渲染提示 + 可选链接。
 */

import { type ReactNode } from 'react';

export type AlertTone = 'info' | 'warning';

export interface AlertProps {
  /** 提示文案。 */
  children: ReactNode;
  /** 语气：info（蓝）、warning（黄）。 */
  tone?: AlertTone;
  /** 可选的链接节点（通常为 next/link）。 */
  action?: ReactNode;
  className?: string;
}

const TONE_STYLES: Record<AlertTone, string> = {
  info: 'border-blue-200 bg-blue-50 text-blue-800',
  warning: 'border-yellow-200 bg-yellow-50 text-yellow-800',
};

export function Alert({ children, tone = 'info', action, className }: AlertProps) {
  return (
    <div
      className={`flex flex-wrap items-center justify-between gap-3 rounded-md border px-4 py-3 text-sm ${TONE_STYLES[tone]} ${className ?? ''}`}
      role="note"
    >
      <span className="min-w-0">{children}</span>
      {action ? <div className="shrink-0 text-sm font-medium">{action}</div> : null}
    </div>
  );
}
