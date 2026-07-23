'use client';

import { Suspense as ReactSuspense, useMemo } from 'react';
import { useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { usePersistFn } from '@svton/hooks';
import { LoadingState } from '@svton/ui';
import { PageHeader, ErrorBanner, Button } from '@/components/ui';
import { ActionMenu } from '@/components/ui/action-menu';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { useExecutionGovernance } from '../hooks/use-execution-governance';
import { GovernanceOverview } from './overview-cards';
import { GovernanceTabs } from './governance-tabs';
import {
  formatExecutionJobScope,
  readExecutionGovernanceScope,
} from '../execution-governance-scope.utils';

const Suspense = ReactSuspense as unknown as (props: {
  fallback: React.ReactNode;
  children: React.ReactNode;
}) => JSX.Element;

export function ExecutionGovernanceContent() {
  const tc = useTranslations('common');
  return (
    <Suspense fallback={<LoadingState text={tc('loading')} />}>
      <ExecutionGovernanceInner />
    </Suspense>
  );
}

function ExecutionGovernanceInner() {
  const t = useTranslations('executionGovernance');
  const tc = useTranslations('common');
  const searchParams = useSearchParams();
  const scope = useMemo(() => readExecutionGovernanceScope(searchParams), [searchParams]);
  const scopeSummary = useMemo(() => formatExecutionJobScope(scope), [scope]);
  const gov = useExecutionGovernance(scope);
  const handleRetry = usePersistFn(() => gov.reload());

  return (
    <div className="space-y-6">
      <PageHeader
        title={t('pageTitle')}
        description={t('pageDescription')}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={gov.processNextQueuedJob}
              disabled={gov.processingQueue}
              loading={gov.processingQueue}
            >
              {t('processQueue')}
            </Button>
            <ActionMenu
              triggerLabel={t('moreActions')}
              groups={[
                {
                  items: [
                    {
                      key: 'recoverZombie',
                      label: gov.recoveringStale ? t('recovering') : t('recoverZombie'),
                      disabled: gov.recoveringStale,
                      onSelect: gov.recoverStaleJobs,
                    },
                    {
                      key: 'releaseExpired',
                      label: gov.actingLease ? t('processing') : t('releaseExpired'),
                      disabled: gov.actingLease,
                      onSelect: gov.expireStale,
                    },
                    {
                      key: 'refresh',
                      label: tc('refresh'),
                      onSelect: handleRetry,
                    },
                  ],
                },
              ]}
            />
          </div>
        }
      />

      {gov.error ? (
        <ErrorBanner
          message={gov.error}
          onRetry={handleRetry}
        />
      ) : null}

      {scopeSummary ? (
        <div className="rounded-lg border p-4 text-sm">
          <div className="font-medium">{t('governanceScope')}</div>
          <div className="mt-2 break-all rounded-md bg-muted/50 px-3 py-2 text-xs text-muted-foreground">
            {scopeSummary}
          </div>
        </div>
      ) : null}

      {/* 概览卡作为页面视觉焦点常驻;主管/作业/租约收纳到下方 Tabs,避免平铺。 */}
      <GovernanceOverview
        supervisor={gov.supervisor}
        jobStats={gov.jobStats}
        leaseStats={gov.leaseStats}
      />

      <GovernanceTabs gov={gov} />

      <ConfirmDialog
        open={Boolean(gov.pendingJobAction)}
        onOpenChange={(open) => {
          if (!open) gov.cancelJobAction();
        }}
        tone="warning"
        title={gov.pendingJobAction?.kind === 'cancel' ? t('cancelJobTitle') : t('retryJobTitle')}
        description={
          gov.pendingJobAction
            ? gov.pendingJobAction.kind === 'cancel'
              ? t('cancelJobDescription', { operationKey: gov.pendingJobAction.job.operationKey })
              : t('retryJobDescription', { operationKey: gov.pendingJobAction.job.operationKey })
            : undefined
        }
        confirmLabel={tc('confirm')}
        cancelLabel={tc('cancel')}
        onConfirm={gov.confirmJobAction}
      />
    </div>
  );
}
