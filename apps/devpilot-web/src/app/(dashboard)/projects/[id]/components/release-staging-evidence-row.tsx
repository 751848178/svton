import React, { type ReactNode } from 'react';
import { useTranslations } from 'next-intl';
import { FlowStatusTag } from './release-workbench/release-flow-status-tag';
import type { ReleaseBuildItem, ReleaseStagingDeploymentItem } from '../types/release-order.types';
import { releaseRunStatusLabelKey } from '../utils/release-copy.model';
import { stagingBusinessConclusion, stagingTechnicalConclusion } from '../utils/release-staging-view.model';
import { formatDuration, formatIso } from '../utils/release-time.utils';
import {
  providerKeyLabel,
  shortDigest,
  shortTechnicalId,
} from '../utils/release-display.utils';
import { releaseOrderStatusTone } from '../utils/release-order.utils';
import { ReleaseOrderActions } from './release-order-actions';

/**
 * PX-3/ROD-4/PX-23：行首 cuid 折叠为前 8 位（title 全文，不 break-all）；
 * 构建列以 `BuildRun #revision` 为主、cuid 折叠；Manifest 只展示短 digest。
 */
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
        <span className="block truncate font-semibold">
          DeploymentRun <span title={props.run.id}>{shortTechnicalId(props.run.id)}</span>
        </span>
        <span
          className="mt-1 block truncate text-xs text-muted-foreground"
          title={props.run.adapterKey || props.run.executorKey || undefined}
        >
          {providerKeyLabel(props.run.adapterKey || props.run.executorKey)}
        </span>
      </RowHeader>
      <Cell>
        <strong className="block truncate">
          {props.build
            ? t('releaseBuildRevision', { revision: props.build.revision })
            : t('releaseStagingBuildUnavailable')}
        </strong>
        {props.build ? (
          <code
            className="block truncate text-xs text-muted-foreground"
            title={props.build.id}
          >
            BuildRun {shortTechnicalId(props.build.id)}
          </code>
        ) : null}
        <code
          className="block truncate text-xs"
          title={manifestId ? `${manifestId} · ${props.build?.manifest?.digest ?? ''}` : undefined}
        >
          {shortDigest(props.build?.manifest?.digest) === '—'
            ? shortTechnicalId(manifestId || undefined)
            : shortDigest(props.build?.manifest?.digest)}
        </code>
      </Cell>
      <Cell>
        <FlowStatusTag status={releaseOrderStatusTone(props.run.status)} label={t(releaseRunStatusLabelKey(props.run.status))} />
        {props.run.error ? <span className="mt-1 block line-clamp-2 text-xs text-red-700">{props.run.error}</span> : null}
      </Cell>
      <Cell>
        <Conclusion label={t('releaseStagingTechnicalResult')} conclusion={stagingTechnicalConclusion(props.run)} />
        <Conclusion label={t('releaseStagingBusinessResult')} conclusion={stagingBusinessConclusion(props.run)} />
      </Cell>
      <Cell>
        <span className="block">{formatDuration(props.run.startedAt, props.run.finishedAt) || '—'}</span>
        <time className="block truncate text-xs text-muted-foreground" dateTime={props.run.createdAt}>{formatIso(props.run.createdAt)}</time>
      </Cell>
      {/* 操作列与项目列表一致：ReleaseOrderActions（文字链接 + 溢出菜单）；
          部署证据入口保留在日志抽屉内，行内不再重复。 */}
      <Cell className="text-right">
        <ReleaseOrderActions
          actions={[
            {
              key: 'log',
              label: t('viewReleaseStagingLogs'),
              onSelect: () => props.onOpenLog(props.run.id),
            },
            {
              key: 'redeploy',
              label: t('deployExactManifest'),
              disabled: !manifestId || props.deploying || props.deploymentAllowed === false,
              onSelect: () => props.onDeploy(manifestId),
            },
          ]}
          moreLabel={t('releaseOrderMoreActions')}
        />
      </Cell>
    </tr>
  );
}

function Conclusion(props: { label: string; conclusion: ReturnType<typeof stagingTechnicalConclusion> }) {
  const t = useTranslations('projects');
  return <div className="mb-1 flex flex-wrap items-center gap-1 last:mb-0"><span className="text-xs text-muted-foreground">{props.label}</span><FlowStatusTag status={props.conclusion.tone} label={t(props.conclusion.key)} /></div>;
}

function Cell({ children, className }: { children: ReactNode; className?: string }) { return <td className={`px-3 py-3 align-top ${className ?? ''}`}>{children}</td>; }
function RowHeader({ children }: { children: ReactNode }) { return <th scope="row" className="px-3 py-3 text-left align-top font-normal">{children}</th>; }
