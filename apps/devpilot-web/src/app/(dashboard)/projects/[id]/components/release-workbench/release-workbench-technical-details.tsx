'use client';

import { CaretDown } from '@phosphor-icons/react';
import { useTranslations } from 'next-intl';
import type { ReleaseOrderEvidence } from '../../types/release-order-evidence.types';
import type { ReleaseOrderDetail } from '../../types/release-order.types';
import { latestReleaseManifest } from './release-workbench-summary.model';

export function ReleaseWorkbenchTechnicalDetails(props: {
  detail: ReleaseOrderDetail;
  evidence: ReleaseOrderEvidence | null;
}) {
  const t = useTranslations('projects');
  const manifest = latestReleaseManifest(props.evidence);
  const commit = manifest?.buildRun.sourceCommitSha;
  return (
    <details className="group border-t border-border text-xs text-muted-foreground">
      <summary className="flex min-h-11 w-fit cursor-pointer list-none items-center gap-1 font-medium hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40">
        {t('releaseWorkbenchTechnicalDetails')}
        <CaretDown
          size={14}
          className="transition-transform group-open:rotate-180"
          aria-hidden="true"
        />
      </summary>
      <dl className="grid gap-3 bg-muted/35 p-4 sm:grid-cols-2">
        <TechnicalFact label={t('releaseWorkbenchOrderId')} value={props.detail.id} />
        <TechnicalFact
          label={t('releaseWorkbenchManifest')}
          value={manifest?.id || t('releaseWorkbenchNotGenerated')}
        />
        {manifest?.digest ? (
          <TechnicalFact label={t('releaseWorkbenchDigest')} value={manifest.digest} />
        ) : null}
        {commit ? <TechnicalFact label="Commit" value={commit} /> : null}
      </dl>
    </details>
  );
}

function TechnicalFact({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <dt>{label}</dt>
      <dd className="mt-0.5 break-all font-mono text-foreground">{value}</dd>
    </div>
  );
}
