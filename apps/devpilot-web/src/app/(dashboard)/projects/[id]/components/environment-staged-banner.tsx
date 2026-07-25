/**
 * 环境变量暂存变更顶栏
 *
 * 单一职责：当 draft 与已落库 vars 存在差异时，顶部提示「N 项待部署」并暴露
 * Review & Deploy / Discard 两个动作。无差异时不渲染。
 *
 * 与 useEnvironmentEnvVars 解耦：只接收变更数与回调，不做 diff 计算。
 */

'use client';

import { useTranslations } from 'next-intl';
import { Alert } from '@/components/ui';

type ProjectsTranslator = ReturnType<typeof useTranslations<'projects'>>;

interface EnvironmentStagedBannerProps {
  /** 待部署变更总条数（added + modified + removed）。 */
  pendingCount: number;
  onReview: () => void;
  onDiscard: () => void;
  t: ProjectsTranslator;
}

export function EnvironmentStagedBanner({
  pendingCount,
  onReview,
  onDiscard,
  t,
}: EnvironmentStagedBannerProps) {
  if (pendingCount <= 0) return null;

  return (
    <Alert tone="warning">
      <span>
        {t('stagedChanges', { count: pendingCount })}
      </span>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={onDiscard}
          className="rounded border border-current/30 px-3 py-1 text-xs hover:bg-current/10"
        >
          {t('stagedDiscard')}
        </button>
        <button
          type="button"
          onClick={onReview}
          className="rounded bg-primary px-3 py-1 text-xs font-medium text-primary-foreground hover:bg-primary/90"
        >
          {t('reviewAndDeploy')}
        </button>
      </div>
    </Alert>
  );
}
