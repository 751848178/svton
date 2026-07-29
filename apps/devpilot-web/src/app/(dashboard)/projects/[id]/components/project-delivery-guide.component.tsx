/**
 * 项目交付引导卡。
 *
 * 第一屏回答“现在在哪一步、下一步做什么、为什么”，并展示每步可核验事实。
 */

'use client';

import { useTranslations } from 'next-intl';
import { Button, Card } from '@svton/ui';
import type { useProjectDetail } from '../hooks/use-project-detail';
import type { RepositoryReadiness } from '../types/repository-analysis.types';
import {
  getProjectDeliveryReadiness,
  type DeliveryAction,
  type DeliveryStage,
} from '../utils/project-delivery-readiness.utils';

type DetailHook = ReturnType<typeof useProjectDetail>;

export function ProjectDeliveryGuide({
  detail,
  onAction,
  repositoryReadiness,
}: {
  detail: DetailHook;
  onAction: (action: DeliveryAction, environmentId?: string) => void;
  repositoryReadiness: RepositoryReadiness;
}) {
  const t = useTranslations('projects');
  if (!detail.project) return null;
  const readiness = getProjectDeliveryReadiness(
    detail.project,
    detail.deploymentRuns,
    repositoryReadiness,
  );
  const progress = Math.round((readiness.completedCount / readiness.totalCount) * 100);

  return (
    <Card className="overflow-hidden border-primary/30">
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1.35fr)_minmax(18rem,0.65fr)]">
        <div className="space-y-4">
          <div>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-primary">
                  {t('deliveryGuideEyebrow')}
                </p>
                <h2 className="mt-1 text-lg font-semibold">{t('deliveryGuideTitle')}</h2>
              </div>
              <span className="text-sm font-medium text-muted-foreground">
                {t('deliveryProgress', {
                  completed: readiness.completedCount,
                  total: readiness.totalCount,
                })}
              </span>
            </div>
            <div className="mt-3 h-2 overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full bg-primary transition-all"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
          <ol className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
            {readiness.stages.map((stage, index) => (
              <DeliveryStageItem
                key={stage.key}
                stage={stage}
                index={index}
              />
            ))}
          </ol>
        </div>
        <aside className="rounded-lg border bg-muted/30 p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            {t('deliveryNextLabel')}
          </p>
          <h3 className="mt-2 text-base font-semibold">{t(readiness.nextTitleKey)}</h3>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            {t(readiness.nextDetailKey)}
          </p>
          <Button
            className="mt-4 w-full"
            onClick={() => onAction(readiness.nextAction, readiness.targetEnvironmentId)}
          >
            {t(readiness.nextActionLabelKey)}
          </Button>
          {readiness.nextAction !== 'request_resource' ? (
            <button
              type="button"
              className="mt-3 w-full text-center text-sm text-primary hover:underline"
              onClick={() => onAction('request_resource', readiness.targetEnvironmentId)}
            >
              {t('deliveryActionRequestResource')}
            </button>
          ) : null}
        </aside>
      </div>
    </Card>
  );
}

function DeliveryStageItem({ stage, index }: { stage: DeliveryStage; index: number }) {
  const t = useTranslations('projects');
  const tone = {
    complete: 'border-emerald-500/30 bg-emerald-500/5',
    current: 'border-primary/50 bg-primary/5',
    attention: 'border-amber-500/30 bg-amber-500/5',
    blocked: 'border-border bg-background',
  }[stage.status];
  return (
    <li className={`rounded-md border p-3 ${tone}`}>
      <div className="flex items-start gap-2">
        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border bg-background text-xs font-semibold">
          {index + 1}
        </span>
        <div className="min-w-0">
          <p className="text-sm font-medium">{t(stage.titleKey)}</p>
          <p className="mt-1 text-xs leading-5 text-muted-foreground">{t(stage.detailKey)}</p>
          <p className="mt-1 truncate font-mono text-[11px] text-muted-foreground">
            {t('deliveryEvidence')}: {stage.evidence}
          </p>
        </div>
      </div>
    </li>
  );
}
