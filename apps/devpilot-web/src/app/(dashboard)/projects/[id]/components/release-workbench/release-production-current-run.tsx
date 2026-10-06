'use client';

import Link from 'next/link';
import { ArrowUpRight } from '@phosphor-icons/react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui';
import type { ReleaseEvidenceProductionRun } from '../../types/release-order-evidence.types';
import {
  releaseApprovalStatusLabelKey,
  releaseExecutionStatusLabelKey,
} from '../../utils/release-copy.model';
import { shortTechnicalId } from '../../utils/release-display.utils';
import { formatIso } from '../../utils/release-time.utils';
import { FlowStatusTag } from './release-flow-status-tag';
import { ReleaseProductionFact } from './release-production-fact';
import { ReleaseProductionRunDetails } from './release-production-run-details';

export function ReleaseProductionCurrentRun(props: {
  run: ReleaseEvidenceProductionRun;
  environmentHref: string;
  onOpenLog: () => void;
}) {
  const t = useTranslations('projects');
  const run = props.run;
  return (
    <section
      className="space-y-4 rounded-lg border p-4"
      data-testid="release-production-current-run"
      aria-labelledby="release-production-current-run-title"
    >
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h4
            id="release-production-current-run-title"
            className="text-sm font-semibold"
          >
            {t('releaseProductionCurrentRunTitle')}
          </h4>
          <p
            className="mt-1 truncate font-mono text-xs text-muted-foreground"
            title={run.id}
          >
            ReleaseRun {shortTechnicalId(run.id)}
          </p>
        </div>
        <FlowStatusTag
          status={run.status.toLowerCase()}
          label={t(releaseExecutionStatusLabelKey(run.status))}
        />
      </header>

      <dl className="grid gap-3 border-y py-4 text-sm sm:grid-cols-2 lg:grid-cols-4">
        <ReleaseProductionFact
          label={t('releaseRunCardEnvironment')}
          value={run.environment.name}
        />
        <ReleaseProductionFact
          label={t('releaseBuildRevisionLabel')}
          value={t('releaseBuildRevision', { revision: run.manifest.buildRun.revision })}
        />
        <ReleaseProductionFact
          label={t('releaseApprovalStatus')}
          value={t(releaseApprovalStatusLabelKey(run.operationApproval.status))}
        />
        <ReleaseProductionFact
          label={t('releaseRunCardCreatedAt')}
          value={formatIso(run.createdAt)}
        />
      </dl>

      {run.errorCode || run.errorMessage ? (
        <div
          className="rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive"
          role="alert"
        >
          <p className="font-semibold">{t('releaseProductionFailureTitle')}</p>
          <p className="mt-1 break-all">
            {[run.errorCode, run.errorMessage].filter(Boolean).join(' · ')}
          </p>
        </div>
      ) : null}

      <div className="flex flex-wrap gap-3 border-t pt-4">
        <Button
          variant="secondary"
          size="sm"
          onClick={props.onOpenLog}
        >
          {t('viewProductionLogs')}
        </Button>
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
      <ReleaseProductionRunDetails run={run} />
    </section>
  );
}
