/**
 * 发布错误详情（第 0 步）
 *
 * 单一职责：统一渲染发布链路错误 —— 已知错误码给一句人话主原因，原始文本
 * 折叠为可展开的次要详情；空信息给通用兜底文案。绝不把裸错误码当主原因。
 */

'use client';

import { useTranslations } from 'next-intl';
import { publishErrorCopy } from './publish-error.model';

export function PublishErrorDetail({ raw }: { raw: string | null | undefined }) {
  const t = useTranslations('projects');
  const copy = publishErrorCopy(raw);
  if (!copy.labelKey) {
    return (
      <p
        className="text-sm text-destructive"
        role="alert"
      >
        {copy.detail || t('publishErrorFallback')}
      </p>
    );
  }
  return (
    <div
      className="text-sm text-destructive"
      role="alert"
    >
      <p>{t(copy.labelKey)}</p>
      {copy.detail ? (
        <details className="mt-1 text-xs text-destructive/80">
          <summary className="cursor-pointer">{t('publishErrorDetailSummary')}</summary>
          <p className="mt-1 break-all">{copy.detail}</p>
        </details>
      ) : null}
    </div>
  );
}
