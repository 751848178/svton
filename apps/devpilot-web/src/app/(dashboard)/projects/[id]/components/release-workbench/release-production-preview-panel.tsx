'use client';

import Link from 'next/link';
import { ArrowUpRight, RocketLaunch } from '@phosphor-icons/react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui';
import type { ProductionReleasePreview } from '../../types/release-production.types';
import { shortDigest, shortTechnicalId } from '../../utils/release-display.utils';
import { ReleaseProductionFact } from './release-production-fact';
import { ReleaseTechnicalDetails } from '../release-technical-details';

export function ReleaseProductionPreviewPanel(props: {
  preview: ProductionReleasePreview | null;
  loading: boolean;
  error: string;
  confirming: boolean;
  disabledReason: string;
  environmentHref: string;
  onConfirm: () => void;
}) {
  const t = useTranslations('projects');
  return (
    <section
      className="space-y-4 rounded-lg border p-4"
      data-testid="release-production-preview-panel"
    >
      <div>
        <h4 className="text-sm font-semibold">{t('releaseProductionPendingTitle')}</h4>
        <p className="mt-1 text-xs text-muted-foreground">
          {t('releaseProductionPendingDescription')}
        </p>
      </div>
      {props.preview ? (
        <dl className="grid gap-3 border-y py-4 text-sm sm:grid-cols-3">
          <ReleaseProductionFact
            label={t('releaseProductionCheckTargetEnvironment')}
            value={`${props.preview.snapshot.environment.name} · ${props.preview.snapshot.environment.key}`}
          />
          <ReleaseProductionFact
            label={t('productionVersion')}
            value={props.preview.snapshot.releaseOrder.releaseVersion}
          />
          <ReleaseProductionFact
            label={t('releaseProductionCheckComponents')}
            value={String(props.preview.snapshot.workload.services.length)}
          />
        </dl>
      ) : (
        <p
          className={`rounded-md border p-3 text-sm ${props.error ? 'border-destructive/30 text-destructive' : 'text-muted-foreground'}`}
          role={props.error ? 'alert' : undefined}
        >
          {props.loading
            ? t('productionPreviewLoading')
            : props.error || t('releaseProductionCheckPreviewEmpty')}
        </p>
      )}
      {props.preview ? (
        <ReleaseTechnicalDetails
          items={[
            {
              key: 'manifest',
              label: t('productionArtifact'),
              value: shortDigest(props.preview.snapshot.manifest.digest),
              title: props.preview.snapshot.manifest.digest,
            },
            {
              key: 'revision',
              label: t('releaseProductionCheckConfigRevision'),
              value: `R${props.preview.snapshot.config.revision} · ${shortTechnicalId(props.preview.snapshot.config.revisionId)}`,
              title: props.preview.snapshot.config.revisionId,
            },
            {
              key: 'staging-proof',
              label: t('releaseProductionStagingProofLabel'),
              value: shortTechnicalId(props.preview.snapshot.stagingProof.deploymentRunId),
              title: props.preview.snapshot.stagingProof.deploymentRunId,
            },
          ]}
        />
      ) : null}
      <div className="flex flex-wrap items-start gap-3">
        <div className="flex flex-col gap-1">
          <Button
            size="sm"
            loading={props.confirming}
            disabled={Boolean(props.disabledReason)}
            aria-describedby={props.disabledReason ? 'production-publish-blocked' : undefined}
            data-testid="workbench-production-action"
            onClick={props.onConfirm}
          >
            <RocketLaunch
              size={15}
              weight="bold"
              aria-hidden="true"
            />
            {t('progressToProduction')}
          </Button>
          {props.disabledReason ? (
            <p
              id="production-publish-blocked"
              data-testid="production-publish-blocked-reason"
              className="max-w-xl text-xs text-muted-foreground"
            >
              {props.disabledReason}
            </p>
          ) : null}
        </div>
        <Link
          href={props.environmentHref}
          className="inline-flex min-h-9 items-center gap-1 px-1 text-sm font-medium text-primary hover:underline"
        >
          <ArrowUpRight
            size={14}
            aria-hidden="true"
          />
          {t('releaseRoundProductionGoEnv')}
        </Link>
      </div>
    </section>
  );
}
