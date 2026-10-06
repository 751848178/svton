'use client';

import Link from 'next/link';
import { ArrowUpRight } from '@phosphor-icons/react';
import { useTranslations } from 'next-intl';
import type { ReleaseOrderDetail } from '../../types/release-order.types';
import { FlowStatusTag } from './release-flow-status-tag';
import type { ReleaseLifecycleEvidence } from './release-lifecycle-evidence.model';
import { buildReleaseCompletionRecord } from './release-completion-record.model';
import { ReleaseCompletionFacts } from './release-completion-facts';
import { ReleasePostValidationList } from './release-post-validation-list';

export function ReleaseStepCompletionPanel(props: {
  detail: ReleaseOrderDetail;
  lifecycleEvidence: ReleaseLifecycleEvidence;
}) {
  const t = useTranslations('projects');
  const completion = buildReleaseCompletionRecord(props.detail, props.lifecycleEvidence);
  if (!completion.record) {
    return (
      <section className="rounded-lg border border-warning/40 bg-warning/5 p-4 text-sm">
        <h3 className="font-semibold">{t('releaseCompletionBlockedTitle')}</h3>
        <p className="mt-1 text-muted-foreground">{t('releaseCompletionPending')}</p>
        <ul className="mt-3 list-disc space-y-1 pl-5 text-xs text-muted-foreground">
          {completion.blockers.map((blocker) => (
            <li key={blocker}>{t(`releaseCompletionBlocker.${blocker}`)}</li>
          ))}
        </ul>
      </section>
    );
  }
  const record = completion.record;
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold">{t('releaseCompletionTitle')}</h3>
          <p className="mt-1 text-xs text-muted-foreground">{t('releaseCompletionDescription')}</p>
        </div>
        <FlowStatusTag
          status="success"
          label={t('releaseStepStateCompleted')}
        />
      </div>
      <ReleaseCompletionFacts record={record} />
      <div>
        <h4 className="mb-2 text-sm font-semibold">{t('releaseCompletionValidationTitle')}</h4>
        <ReleasePostValidationList checks={record.validationChecks} />
      </div>
      <div className="flex flex-wrap gap-x-5 gap-y-2">
        <EvidenceLink
          href={`/projects/${encodeURIComponent(props.detail.projectId)}/deployments?runId=${encodeURIComponent(record.deploymentRun.id)}`}
          label={t('releaseCompletionDeploymentEvidence')}
        />
        <EvidenceLink
          href={`/audit-events?projectId=${encodeURIComponent(props.detail.projectId)}&category=release`}
          label={t('releaseCompletionAudit')}
        />
      </div>
    </div>
  );
}

function EvidenceLink(props: { href: string; label: string }) {
  return (
    <Link
      href={props.href}
      className="inline-flex min-h-11 items-center gap-1 text-sm font-medium text-primary hover:underline"
    >
      {props.label}
      <ArrowUpRight
        size={14}
        aria-hidden="true"
      ></ArrowUpRight>
    </Link>
  );
}
