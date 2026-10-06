'use client';

import { useTranslations } from 'next-intl';
import type { ReleaseStagingDeploymentItem } from '../../types/release-order.types';
import { formatIso } from '../../utils/release-time.utils';
import { FlowStatusTag } from './release-flow-status-tag';
import { stagingProbeEvidence } from './release-staging-deployment.model';

export function ReleaseStagingEntryEvidence(props: { deployment: ReleaseStagingDeploymentItem }) {
  const t = useTranslations('projects');
  const items = stagingProbeEvidence(props.deployment);
  return (
    <section
      className="rounded-lg border p-4"
      aria-labelledby="release-staging-entry-title"
    >
      <h4
        id="release-staging-entry-title"
        className="text-sm font-semibold"
      >
        {t('releaseStagingEntryEvidence')}
      </h4>
      <p className="mt-1 text-xs text-muted-foreground">
        {t('releaseStagingEntryEvidenceDescription')}
      </p>
      {items.length ? (
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          {items.map((item) => (
            <article
              key={item.key}
              className="min-w-0 rounded-md border p-3"
            >
              <div className="flex flex-wrap items-center gap-2">
                <h5 className="text-sm font-medium">
                  {t(`releaseStagingEvidenceObject.${item.key}`)}
                </h5>
                <FlowStatusTag
                  status={item.status}
                  label={item.status}
                />
              </div>
              <p className="mt-2 text-xs text-muted-foreground">
                {item.checkedAt
                  ? formatIso(item.checkedAt)
                  : t('releaseStagingEvidenceTimeUnavailable')}
              </p>
              <dl className="mt-2 space-y-1 font-mono text-xs">
                {Object.entries(item.raw).map(([key, value]) => (
                  <div
                    key={key}
                    className="grid grid-cols-[minmax(0,8rem)_minmax(0,1fr)] gap-2"
                  >
                    <dt className="break-all text-muted-foreground">{key}</dt>
                    <dd className="break-all">{display(value)}</dd>
                  </div>
                ))}
              </dl>
            </article>
          ))}
        </div>
      ) : (
        <p className="mt-3 text-sm text-muted-foreground">
          {t('releaseStagingEntryEvidenceUnavailable')}
        </p>
      )}
    </section>
  );
}

function display(value: unknown) {
  if (value === null || value === undefined || value === '') return '—';
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }
  return JSON.stringify(value);
}
