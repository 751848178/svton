'use client';

import { useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Button, LinkButton, StatusTag } from '@/components/ui';
import type {
  EnvironmentVersionCandidate,
  EnvironmentVersionEnvironment,
  ProductionPromotionResumeInput,
} from '../types/environment-version.types';
import { releaseOrderHref } from '../utils/project-route.utils';
import { frozenProductionCandidate } from '../utils/production-promotion-candidate.model';

export function EnvironmentAwaitingPromotion(props: {
  projectId: string;
  environment: EnvironmentVersionEnvironment;
  candidate?: EnvironmentVersionCandidate;
  executing: boolean;
  onResume: (input: ProductionPromotionResumeInput) => Promise<unknown>;
}) {
  const t = useTranslations('projects');
  const searchParams = useSearchParams();
  const release = props.environment.releaseRuns?.find(
    (item) => item.status === 'awaiting_validation',
  );
  const deployment = release?.deploymentRuns.find(
    (item) => item.status === 'awaiting_validation',
  );
  const candidate = frozenProductionCandidate(deployment?.result);
  if (!release || !deployment || !candidate) return null;
  const detailsHref = releaseOrderHref(
    props.projectId,
    props.candidate?.releaseOrder.id ?? candidate.releaseOrderId,
    'production',
    searchParams,
    { releaseRunId: release.id, deploymentRunId: deployment.id },
  );
  return (
    <section className="rounded-md border border-amber-500/40 bg-amber-500/10 p-3" role="status">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="font-medium">{t('environmentVersionAwaitingValidation')}</p>
          <p className="mt-1 text-xs text-muted-foreground">
            {t('environmentVersionAwaitingCandidate', {
              version: props.candidate?.releaseOrder.releaseVersion ?? candidate.manifestId,
            })}
          </p>
        </div>
        <StatusTag status="warning" label={t('environmentVersionManualRequired')} />
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        <Button
          className="min-h-11"
          loading={props.executing}
          disabled={props.executing}
          onClick={() => void props.onResume({
            releaseRunId: release.id,
            deploymentRunId: deployment.id,
            candidateHash: candidate.candidateHash,
          })}
        >
          {t('environmentVersionContinueProduction')}
        </Button>
        <LinkButton className="min-h-11" variant="outline" href={detailsHref}>
          {t('environmentVersionReviewManualGates')}
        </LinkButton>
      </div>
    </section>
  );
}
