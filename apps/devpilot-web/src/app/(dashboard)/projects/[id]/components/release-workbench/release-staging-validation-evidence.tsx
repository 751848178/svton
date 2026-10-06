'use client';

import { useTranslations } from 'next-intl';
import { formatIso } from '../../utils/release-time.utils';
import { FlowStatusTag } from './release-flow-status-tag';
import type { ReleaseValidationCheck } from './release-staging-validation.model';

export function ReleaseStagingValidationEvidence(props: { checks: ReleaseValidationCheck[] }) {
  const t = useTranslations('projects');
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {props.checks.map((check) => (
        <section
          key={check.key}
          className="min-w-0 rounded-lg border p-3"
          data-testid={`staging-validation-${check.key}`}
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h4 className="text-sm font-medium">{t(`releaseStagingCheck.${check.key}`)}</h4>
            <FlowStatusTag
              status={check.tone}
              label={t(`releaseStagingCheckStatus.${check.label}`)}
            />
          </div>
          <dl className="mt-3 space-y-2 text-xs">
            <Fact
              label={t('releaseStagingValidationObject')}
              value={t(`releaseStagingCheckObject.${check.key}`)}
            />
            <Fact
              label={t('releaseStagingValidationSource')}
              value={`${check.sourcePath}.status`}
              mono
            />
            <Fact
              label={t('releaseStagingEvidenceTimeColumn')}
              value={formatIso(check.checkedAt)}
            />
          </dl>
          <details className="mt-3">
            <summary className="cursor-pointer text-xs font-medium text-primary">
              {t('releaseEvidenceRawToggle')}
            </summary>
            <pre className="mt-2 whitespace-pre-wrap break-all rounded bg-muted p-3 font-mono text-xs">
              {check.raw
                ? JSON.stringify(check.raw, null, 2)
                : t('releaseStagingValidationRawUnavailable')}
            </pre>
          </details>
        </section>
      ))}
    </div>
  );
}

function Fact(props: { label: string; value: string; mono?: boolean }) {
  return (
    <div>
      <dt className="text-muted-foreground">{props.label}</dt>
      <dd className={`mt-0.5 break-all ${props.mono ? 'font-mono' : ''}`}>{props.value}</dd>
    </div>
  );
}
