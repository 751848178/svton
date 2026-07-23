'use client';

import { useTranslations } from 'next-intl';
import { Button, Popover } from '@svton/ui';

type ApplicationsPageActionsProps = {
  queueDeploymentRuns: boolean;
  queueServiceOperations: boolean;
  onQueueDeploymentRunsChange: (value: boolean) => void;
  onQueueServiceOperationsChange: (value: boolean) => void;
  onRefresh: () => void;
};

/** 三点(更多)图标。 */
function MoreIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
      className={className}
    >
      <circle cx="5" cy="12" r="1.6" />
      <circle cx="12" cy="12" r="1.6" />
      <circle cx="19" cy="12" r="1.6" />
    </svg>
  );
}

/**
 * 页面操作区:刷新 + 「执行选项」收纳到三点菜单。
 *
 * 队列入队/立即执行的偏好不属于页面主关注点(issue #3),不占首屏显眼位置;
 * 通过三点 Popover 折叠,既保留能力又让页面头部聚焦于标题与刷新。
 */
export function ApplicationsPageActions({
  queueDeploymentRuns,
  queueServiceOperations,
  onQueueDeploymentRunsChange,
  onQueueServiceOperationsChange,
  onRefresh,
}: ApplicationsPageActionsProps) {
  const t = useTranslations('applications');
  const tc = useTranslations('common');
  return (
    <div className="flex items-center gap-2">
      <Button
        variant="outline"
        size="sm"
        onClick={onRefresh}
      >
        {tc('refresh')}
      </Button>
      <Popover
        placement="bottom-end"
        content={
          <div className="w-64 space-y-3">
            <p className="text-xs font-medium text-muted-foreground">
              {t('queueHint')}
            </p>
            <label className="flex items-start gap-2 text-sm">
              <input
                type="checkbox"
                checked={queueDeploymentRuns}
                onChange={(event) => onQueueDeploymentRunsChange(event.target.checked)}
                className="mt-0.5"
              />
              <span>
                <span className="block">{t('queueDeploymentRuns')}</span>
              </span>
            </label>
            <label className="flex items-start gap-2 text-sm">
              <input
                type="checkbox"
                checked={queueServiceOperations}
                onChange={(event) => onQueueServiceOperationsChange(event.target.checked)}
                className="mt-0.5"
              />
              <span>
                <span className="block">{t('queueServiceOperations')}</span>
              </span>
            </label>
          </div>
        }
      >
        <Button
          variant="outline"
          size="sm"
          aria-label={t('executionOptions')}
        >
          <MoreIcon className="h-4 w-4" />
        </Button>
      </Popover>
    </div>
  );
}
