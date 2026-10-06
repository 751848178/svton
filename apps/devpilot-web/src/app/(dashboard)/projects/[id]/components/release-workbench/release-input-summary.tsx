'use client';

import { useTranslations } from 'next-intl';
import type { ProjectDeliverySummary } from '../../types/project-delivery-summary.types';
import type { ReleaseOrderDetail } from '../../types/release-order.types';
import { buildReleaseInputFacts } from './release-input.model';

export function ReleaseInputSummary(props: {
  detail: ReleaseOrderDetail;
  projectSummary?: ProjectDeliverySummary;
}) {
  const t = useTranslations('projects');
  const facts = buildReleaseInputFacts(props);
  const missing = [
    !facts.sourceBranch && t('releaseInputMissingSource'),
    !facts.targetEnvironment && t('releaseInputMissingTarget'),
  ].filter((item): item is string => Boolean(item));
  return (
    <section className="rounded-lg border bg-white p-4 sm:p-5">
      <h2 className="text-base font-semibold">{t('releaseInputTitle')}</h2>
      <p className="mt-1 text-xs text-muted-foreground">{t('releaseInputDescription')}</p>
      {missing.length > 0 ? (
        <p className="mt-3 rounded-md border border-warning/40 bg-warning/5 px-3 py-2 text-xs text-muted-foreground">
          {missing.join(' · ')}
        </p>
      ) : null}
      <dl className="mt-4 grid gap-x-6 gap-y-4 border-t pt-4 text-sm sm:grid-cols-3">
        <Fact
          label={t('releaseInputVersion')}
          value={facts.releaseVersion}
        />
        <Fact
          label={t('releaseInputSource')}
          value={facts.sourceBranch ?? '—'}
        />
        <Fact
          label={t('releaseStagingEnvironment')}
          value={facts.targetEnvironment ?? '—'}
        />
      </dl>
    </section>
  );
}

function Fact(props: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs text-muted-foreground">{props.label}</dt>
      <dd
        className="mt-1 truncate font-medium"
        title={props.value}
      >
        {props.value}
      </dd>
    </div>
  );
}
