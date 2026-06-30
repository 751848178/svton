/**
 * 错误提示横幅
 *
 * 统一列表页与弹窗中的错误展示。
 * 替代 15+ 页面重复的 `<div className="rounded-md border border-red-200 ...">{error}</div>`。
 *
 * 单一职责：渲染错误信息 + 可选重试。无业务逻辑。
 */

export interface ErrorBannerProps {
  /** 错误信息，为空时不渲染。 */
  message?: string | null;
  /** 变体：page（列表页带边框）、inline（弹窗内轻量）。 */
  variant?: 'page' | 'inline';
  /** 重试按钮回调。 */
  onRetry?: () => void;
  /** 重试按钮文案。 */
  retryLabel?: string;
  className?: string;
}

export function ErrorBanner({
  message,
  variant = 'page',
  onRetry,
  retryLabel = '重试',
  className,
}: ErrorBannerProps) {
  if (!message) return null;

  const styles =
    variant === 'page'
      ? 'rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700'
      : 'mb-4 rounded-md bg-destructive/10 p-3 text-sm text-destructive';

  return (
    <div className={`flex items-center justify-between gap-3 ${styles} ${className ?? ''}`}>
      <span>{message}</span>
      {onRetry ? (
        <button
          type="button"
          onClick={onRetry}
          className="shrink-0 text-xs font-medium underline underline-offset-2 hover:opacity-80"
        >
          {retryLabel}
        </button>
      ) : null}
    </div>
  );
}
