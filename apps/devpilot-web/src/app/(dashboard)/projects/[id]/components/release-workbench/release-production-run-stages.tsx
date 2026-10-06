'use client';

import { useTranslations } from 'next-intl';
import type { ReleaseEvidenceDeploymentRun } from '../../types/release-order-evidence.types';
import { releaseExecutionStatusLabelKey } from '../../utils/release-copy.model';
import { shortTechnicalId } from '../../utils/release-display.utils';
import { formatIso } from '../../utils/release-time.utils';
import { FlowStatusTag } from './release-flow-status-tag';

export function ReleaseProductionRunStages(props: { runs: ReleaseEvidenceDeploymentRun[] }) {
  const t = useTranslations('projects');
  return (
    <section
      className="border-t pt-4"
      aria-labelledby="release-production-stages-title"
    >
      <h5
        id="release-production-stages-title"
        className="text-sm font-semibold"
      >
        {t('releaseProductionDeploymentStages')}
      </h5>
      {props.runs.length > 0 ? (
        <div className="mt-3 divide-y rounded-lg border">
          {props.runs.map((run) => (
            <article
              key={run.id}
              className="grid min-w-0 gap-3 p-3 text-xs sm:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)_minmax(0,1fr)]"
            >
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <code
                    className="font-semibold"
                    title={run.id}
                  >
                    DeploymentRun {shortTechnicalId(run.id)}
                  </code>
                  <FlowStatusTag
                    status={run.status.toLowerCase()}
                    label={t(releaseExecutionStatusLabelKey(run.status))}
                  />
                </div>
                <p className="mt-1 break-all text-muted-foreground">
                  {run.source} · {run.targetType} · dryRun={String(run.dryRun)}
                </p>
              </div>
              <div className="min-w-0">
                <p className="text-muted-foreground">{t('releaseProductionDeploymentProvider')}</p>
                <p className="mt-1 break-all">
                  {run.executorKey} · {run.adapterKey}
                </p>
              </div>
              <div className="min-w-0">
                <p className="text-muted-foreground">{t('releaseProductionDeploymentTiming')}</p>
                <p className="mt-1">
                  {formatIso(run.startedAt)} → {formatIso(run.finishedAt)}
                </p>
                {run.error ? <p className="mt-1 break-all text-destructive">{run.error}</p> : null}
              </div>
            </article>
          ))}
        </div>
      ) : (
        <p className="mt-3 rounded-md border p-3 text-sm text-muted-foreground">
          {t('releaseProductionDeploymentStagesEmpty')}
        </p>
      )}
    </section>
  );
}
