/**
 * 取数兜底边界
 *
 * 解决诉求：各页 `if(loading) return <LoadingState/>` 无超时/错误态/重试，
 * 一个挂起的后台任务即可造成全站永久 spinner 的可用性事故（A21）。
 *
 * 单一职责：
 *  - loading 时启动 12s 计时器，到点切换为「加载时间较长，可重试」并暴露重试入口；
 *  - error 时渲染 ErrorBanner（主显示错误码+建议操作，技术原文折叠）；
 *  - 否则透传 children。
 *
 * 不替代 SWR 的去重/缓存，也不发请求——重试由上层 onRetry 触发。
 */

'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { useTranslations } from 'next-intl';
import { LoadingState } from '@svton/ui';
import { ErrorBanner } from './error-banner';
import { ApiError } from '@svton/api-client';

/** 视为「加载缓慢」的阈值（毫秒）。低于此值仍显示普通 spinner。 */
const SLOW_THRESHOLD_MS = 12_000;

export interface DataBoundaryProps {
  /** 是否仍在加载。 */
  loading?: boolean;
  /** 取数错误（Error / ApiError / 任意值）。 */
  error?: unknown;
  /** 重试回调。为空时不显示重试按钮。 */
  onRetry?: () => void;
  /** 加载阶段的骨架（默认 LoadingState）。 */
  skeleton?: ReactNode;
  /** 正常内容。 */
  children: ReactNode;
  /** 自定义根容器 className。 */
  className?: string;
}

export function DataBoundary({
  loading,
  error,
  onRetry,
  skeleton,
  children,
  className,
}: DataBoundaryProps) {
  const t = useTranslations('common');
  const [slow, setSlow] = useState(false);

  useEffect(() => {
    if (!loading) {
      setSlow(false);
      return;
    }
    setSlow(false);
    const timer = setTimeout(() => setSlow(true), SLOW_THRESHOLD_MS);
    return () => clearTimeout(timer);
  }, [loading]);

  if (error) {
    return (
      <div className={className}>
        <ErrorBanner
          message={summarizeError(error, t)}
          onRetry={onRetry}
          retryLabel={t('retry')}
        />
        <ErrorDetails error={error} />
      </div>
    );
  }

  if (loading) {
    if (slow) {
      return (
        <div
          className={`flex flex-col items-start gap-2 rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 ${className ?? ''}`}
        >
          <span className="font-medium">{t('loadSlow')}</span>
          <span className="text-xs text-amber-700">{t('loadSlowHint')}</span>
          {onRetry ? (
            <button
              type="button"
              onClick={onRetry}
              className="mt-1 rounded-md border border-amber-300 px-3 py-1 text-xs font-medium text-amber-800 hover:bg-amber-100"
            >
              {t('retry')}
            </button>
          ) : null}
        </div>
      );
    }
    return <div className={className}>{skeleton ?? <LoadingState text={t('loading')} />}</div>;
  }

  return <div className={className}>{children}</div>;
}

/** 主显示文案：错误码 + 建议操作（用户化），技术原文交给 ErrorDetails。 */
function summarizeError(error: unknown, t: (k: string) => string): string {
  // 字符串错误（如各页 hook 已本地化好的失败原因）直接透传，避免丢失上下文。
  if (typeof error === 'string' && error.trim()) return error;
  if (error instanceof ApiError) {
    return `${t('loadFailed')} (code: ${error.code})`;
  }
  if (error instanceof Error && error.name === 'TimeoutError') {
    return `${t('loadFailed')} (timeout)`;
  }
  return t('loadFailed');
}

/** 技术原文折叠展示：默认收起，避免把堆栈/原始 message 塞给终端用户。 */
function ErrorDetails({ error }: { error: unknown }) {
  const t = useTranslations('common');
  const raw =
    error instanceof Error
      ? `${error.name}: ${error.message}`
      : typeof error === 'string'
        ? error
        : '';
  if (!raw) return null;
  return (
    <details className="mt-2 text-xs text-muted-foreground">
      <summary className="cursor-pointer select-none">{t('errorDetails')}</summary>
      <pre className="mt-1 whitespace-pre-wrap break-all font-mono">{raw}</pre>
    </details>
  );
}
