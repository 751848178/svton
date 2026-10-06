'use client';

import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui';
import type { ReleaseStagingDeploymentItem } from '../../types/release-order.types';
import {
  stagingBusinessConclusion,
  stagingTechnicalConclusion,
} from '../../utils/release-staging-view.model';
import { formatIso } from '../../utils/release-time.utils';
import { FlowStatusTag } from './release-flow-status-tag';
import { ReleaseValidationEvidenceList } from './release-validation-evidence-list';
import { releaseStagingValidationChecks } from './release-staging-validation.model';

interface Props {
  deployment: ReleaseStagingDeploymentItem | null;
  onOpenEvidence: (runId: string) => void;
}

export function ReleaseStepStagingValidationPanel(props: Props) {
  const t = useTranslations('projects');
  if (!props.deployment) {
    return <EmptyValidation text={t('releaseStagingValidationNoDeployment')} />;
  }
  const technical = stagingTechnicalConclusion(props.deployment);
  const business = stagingBusinessConclusion(props.deployment);
  const checks = releaseStagingValidationChecks(props.deployment);
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold">{t('releaseStagingValidationTitle')}</h3>
          <p className="mt-1 text-xs text-muted-foreground">
            {t('releaseStagingValidationDescription')}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <FlowStatusTag
            status={technical.tone}
            label={t(technical.key)}
          />
          <Button
            variant="outline"
            size="sm"
            onClick={() => props.onOpenEvidence(props.deployment!.id)}
          >
            {t('releaseStagingViewEvidence')}
          </Button>
        </div>
      </div>
      <ReleaseValidationEvidenceList
        columns={{
          check: t('releaseStagingCheckColumn'),
          object: t('releaseStagingObjectColumn'),
          result: t('releaseStagingResultColumn'),
          time: t('releaseStagingEvidenceTimeColumn'),
        }}
        rows={checks.map((check) => ({
          key: check.key,
          check: t(`releaseStagingCheck.${check.key}`),
          object: t(`releaseStagingCheckObject.${check.key}`),
          result: t(`releaseStagingCheckStatus.${check.label}`),
          tone: check.tone,
          time: formatIso(check.checkedAt),
        }))}
      />
      <p className="text-xs text-muted-foreground">
        {t('releaseStagingBusinessResultDetail')} · {t(business.key)}
      </p>
    </div>
  );
}

function EmptyValidation({ text }: { text: string }) {
  return <p className="rounded-lg border p-4 text-sm text-muted-foreground">{text}</p>;
}
