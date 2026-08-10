import React, { type ReactNode } from 'react';
import { useTranslations } from 'next-intl';
import { Button, StatusTag } from '@/components/ui';
import type { ReleaseBuildItem, ReleaseStagingDeploymentItem } from '../types/release-order.types';
import { releaseRunStatusLabelKey } from '../utils/release-copy.model';
import { stagingBusinessConclusion, stagingTechnicalConclusion } from '../utils/release-staging-view.model';
import { formatDuration, formatIso } from '../utils/release-time.utils';
import { releaseOrderStatusTone } from '../utils/release-order.utils';
import { ReleaseDeploymentEvidenceLink } from './release-deployment-evidence-link';

export function ReleaseStagingEvidenceRow(props: {
  run: ReleaseStagingDeploymentItem;
  build: ReleaseBuildItem | null;
  focused: boolean;
  deploying: boolean;
  deploymentAllowed?: boolean;
  onOpenLog: (runId: string) => void;
  onDeploy: (manifestId: string) => void;
}) {
  const t = useTranslations('projects');
  const manifestId = props.run.artifactManifestId || props.build?.manifest?.id || '';
  return (
    <tr className={props.focused ? 'bg-primary/5' : undefined} aria-current={props.focused ? 'true' : undefined} data-deployment-run-id={props.run.id}>
      <RowHeader>
        <code className="block break-all font-semibold">DeploymentRun {props.run.id}</code>
        <span className="mt-1 block text-xs text-muted-foreground">{props.run.adapterKey || props.run.executorKey}</span>
      </RowHeader>
      <Cell>
        <strong className="block">{props.build ? `BuildRun ${props.build.id} · R${props.build.revision}` : t('releaseStagingBuildUnavailable')}</strong>
        <code className="mt-1 block break-all text-xs">Manifest {manifestId || '—'}</code>
        {props.build?.manifest?.digest ? <code className="block truncate text-xs text-muted-foreground">{props.build.manifest.digest}</code> : null}
      </Cell>
      <Cell>
        <StatusTag status={releaseOrderStatusTone(props.run.status)} label={t(releaseRunStatusLabelKey(props.run.status))} />
        {props.run.error ? <span className="mt-1 block line-clamp-2 text-xs text-red-700">{props.run.error}</span> : null}
      </Cell>
      <Cell>
        <Conclusion label={t('releaseStagingTechnicalResult')} conclusion={stagingTechnicalConclusion(props.run)} />
        <Conclusion label={t('releaseStagingBusinessResult')} conclusion={stagingBusinessConclusion(props.run)} />
      </Cell>
      <Cell>
        <span className="block">{formatDuration(props.run.startedAt, props.run.finishedAt) || '—'}</span>
        <time className="block text-xs text-muted-foreground" dateTime={props.run.createdAt}>{formatIso(props.run.createdAt)}</time>
      </Cell>
      <Cell>
        <div className="flex flex-col items-start gap-2">
          <Button size="sm" variant="outline" aria-label={t('viewReleaseStagingLogsForRun', { id: props.run.id })} onClick={() => props.onOpenLog(props.run.id)}>{t('viewReleaseStagingLogs')}</Button>
          <Button size="sm" aria-label={t('deployExactManifestForRun', { runId: props.run.id, manifestId })} disabled={!manifestId || props.deploying || props.deploymentAllowed === false} onClick={() => props.onDeploy(manifestId)}>{t('deployExactManifest')}</Button>
          <ReleaseDeploymentEvidenceLink projectId={props.run.projectId} runId={props.run.id} />
        </div>
      </Cell>
    </tr>
  );
}

function Conclusion(props: { label: string; conclusion: ReturnType<typeof stagingTechnicalConclusion> }) {
  const t = useTranslations('projects');
  return <div className="mb-1 flex flex-wrap items-center gap-1 last:mb-0"><span className="text-xs text-muted-foreground">{props.label}</span><StatusTag status={props.conclusion.tone} label={t(props.conclusion.key)} /></div>;
}

function Cell({ children }: { children: ReactNode }) { return <td className="px-4 py-3 align-top">{children}</td>; }
function RowHeader({ children }: { children: ReactNode }) { return <th scope="row" className="px-4 py-3 text-left align-top font-normal">{children}</th>; }
