'use client';

import { ArrowClockwise } from '@phosphor-icons/react';
import { useTranslations } from 'next-intl';
import { LoadingState, Tabs } from '@svton/ui';
import { Button, ErrorBanner } from '@/components/ui';
import { useProductionReleases } from '../../hooks/use-production-releases';
import type { ReleaseBuildItem } from '../../types/release-order.types';
import type { ReleaseEvidenceProductionRun } from '../../types/release-order-evidence.types';
import type { ReleaseStagingValidationEvidence } from '../../utils/release-staging-view.model';
import { stagingTechnicalConclusion } from '../../utils/release-staging-view.model';
import { ReleaseProductionCheckFacts } from './release-production-check-facts';
import { ReleaseProductionCheckGuards } from './release-production-check-guards';
import { ReleaseProductionCheckList } from './release-production-check-list';
import { ReleaseProductionCheckOverview } from './release-production-check-overview';
import { productionCheckCounts } from './release-production-check.model';

interface Props {
  projectId: string;
  releaseOrderId: string;
  stagingProof: ReleaseStagingValidationEvidence | null;
  manifestBuild: ReleaseBuildItem | null;
  productionRun: ReleaseEvidenceProductionRun | null;
  onChanged: () => Promise<unknown>;
}

export function ReleaseStepProductionCheckPanel(props: Props) {
  const t = useTranslations('projects');
  const manifestId = props.manifestBuild?.manifest?.id || '';
  const staging = props.stagingProof ? stagingTechnicalConclusion(props.stagingProof) : null;
  const enabled = Boolean(manifestId && staging?.tone === 'success');
  const production = useProductionReleases(
    props.projectId,
    props.releaseOrderId,
    manifestId,
    props.onChanged,
    enabled,
  );

  if (!enabled) {
    return (
      <p className="rounded-lg border p-4 text-sm text-muted-foreground">
        {t('releaseProductionCheckUnavailable')}
      </p>
    );
  }
  if (production.loading && !production.preview) {
    return <LoadingState text={t('productionPreviewLoading')} />;
  }
  if (!production.preview) {
    return production.error ? (
      <ErrorBanner
        message={production.error}
        onRetry={production.load}
      />
    ) : (
      <p className="rounded-lg border p-4 text-sm text-muted-foreground">
        {t('releaseProductionCheckPreviewEmpty')}
      </p>
    );
  }

  const preview = production.preview;
  const counts = productionCheckCounts(preview);
  return (
    <div
      className="space-y-4"
      data-testid="production-check-panel"
    >
      {production.error ? (
        <ErrorBanner
          message={production.error}
          onRetry={production.refreshPreflight}
        />
      ) : null}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold">{t('releaseProductionCheckTitle')}</h3>
          <p className="mt-1 text-xs text-muted-foreground">
            {t('releaseProductionCheckDescription', counts)}
          </p>
        </div>
        <Button
          size="sm"
          loading={production.refreshing}
          onClick={() => void production.refreshPreflight()}
        >
          <ArrowClockwise
            size={14}
            aria-hidden="true"
          />
          {t('releaseGateRefresh')}
        </Button>
      </div>
      <Tabs
        type="line"
        defaultActiveKey="overview"
        items={[
          {
            key: 'overview',
            label: t('deploymentEvidenceOverview'),
            children: <ReleaseProductionCheckOverview preview={preview} />,
          },
          {
            key: 'checks',
            label: t('releaseProductionCheckAllChecksTab'),
            children: <ReleaseProductionCheckList preview={preview} />,
          },
          {
            key: 'technical',
            label: t('releaseRunTechnicalDetails'),
            children: (
              <div className="space-y-4">
                <ReleaseProductionCheckFacts preview={preview} />
                <ReleaseProductionCheckGuards
                  preview={preview}
                  operationApproval={props.productionRun?.operationApproval ?? null}
                />
              </div>
            ),
          },
        ]}
      />
    </div>
  );
}
