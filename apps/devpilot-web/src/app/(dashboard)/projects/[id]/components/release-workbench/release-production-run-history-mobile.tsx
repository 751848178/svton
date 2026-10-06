'use client';

import { useTranslations } from 'next-intl';
import type { ReleaseEvidenceProductionRun } from '../../types/release-order-evidence.types';
import {
  releaseApprovalStatusLabelKey,
  releaseExecutionStatusLabelKey,
} from '../../utils/release-copy.model';
import { shortDigest, shortTechnicalId } from '../../utils/release-display.utils';
import { formatIso } from '../../utils/release-time.utils';
import { ReleaseOrderActions } from '../release-order-actions';
import { FlowStatusTag } from './release-flow-status-tag';

export function ReleaseProductionRunHistoryMobile(props: {
  runs: ReleaseEvidenceProductionRun[];
  focusedRunId?: string;
  onOpenLog: (runId: string) => void;
}) {
  const t = useTranslations('projects');
  return (
    <div className="divide-y sm:hidden">
      {props.runs.map((run) => (
        <article
          key={run.id}
          className={`space-y-3 p-4 ${run.id === props.focusedRunId ? 'bg-primary/5' : ''}`}
          aria-current={run.id === props.focusedRunId ? 'true' : undefined}
        >
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p
                className="truncate font-semibold"
                title={run.id}
              >
                ReleaseRun {shortTechnicalId(run.id)}
              </p>
              <time
                className="text-xs text-muted-foreground"
                dateTime={run.createdAt}
              >
                {formatIso(run.createdAt)}
              </time>
            </div>
            <FlowStatusTag
              status={run.status.toLowerCase()}
              label={t(releaseExecutionStatusLabelKey(run.status))}
            />
          </div>
          <MobileFact label={t('releaseProductionColumnApproval')}>
            <FlowStatusTag
              status={run.operationApproval.status.toLowerCase()}
              label={t(releaseApprovalStatusLabelKey(run.operationApproval.status))}
            />
            <span className="ml-2 text-muted-foreground">
              {run.operationApproval.reviewer?.name ?? run.operationApproval.requester?.name ?? '—'}
            </span>
          </MobileFact>
          <MobileFact label={t('productionArtifact')}>
            <code
              className="break-all"
              title={run.manifest.digest}
            >
              {shortDigest(run.manifest.digest)} · #{run.manifest.buildRun.revision}
            </code>
          </MobileFact>
          <ReleaseOrderActions
            actions={[
              {
                key: 'log',
                label: t('viewProductionLogs'),
                onSelect: () => props.onOpenLog(run.id),
              },
            ]}
            moreLabel={t('releaseOrderMoreActions')}
          />
        </article>
      ))}
    </div>
  );
}

function MobileFact(props: React.PropsWithChildren<{ label: string }>) {
  return (
    <div className="text-xs">
      <p className="text-muted-foreground">{props.label}</p>
      <div className="mt-1">{props.children}</div>
    </div>
  );
}
