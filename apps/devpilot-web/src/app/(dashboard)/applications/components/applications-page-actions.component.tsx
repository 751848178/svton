'use client';

import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui';

type ApplicationsPageActionsProps = {
  queueDeploymentRuns: boolean;
  queueServiceOperations: boolean;
  onQueueDeploymentRunsChange: (value: boolean) => void;
  onQueueServiceOperationsChange: (value: boolean) => void;
  onRefresh: () => void;
};

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
    <div className="flex flex-wrap items-center gap-3">
      <fieldset className="rounded-md border bg-card/50 p-2">
        <legend className="px-1 text-xs text-muted-foreground">{t('queueHint')}</legend>
        <div className="flex flex-col gap-1">
          <label className="flex items-center gap-2 text-sm text-muted-foreground">
            <input
              type="checkbox"
              checked={queueDeploymentRuns}
              onChange={(event) => onQueueDeploymentRunsChange(event.target.checked)}
            />
            {t('queueDeploymentRuns')}
          </label>
          <label className="flex items-center gap-2 text-sm text-muted-foreground">
            <input
              type="checkbox"
              checked={queueServiceOperations}
              onChange={(event) => onQueueServiceOperationsChange(event.target.checked)}
            />
            {t('queueServiceOperations')}
          </label>
        </div>
      </fieldset>
      <Button
        variant="outline"
        size="sm"
        onClick={onRefresh}
      >
        {tc('refresh')}
      </Button>
    </div>
  );
}
