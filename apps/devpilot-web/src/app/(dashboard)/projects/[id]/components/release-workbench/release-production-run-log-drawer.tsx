/**
 * 生产发布运行日志抽屉：单个 ReleaseRun 的状态、审批与各 DeploymentRun 日志。
 * 数据来自发布单 evidence（无额外请求）；由生产发布记录行「日志」打开。
 */
'use client';

import { useTranslations } from 'next-intl';
import { Drawer } from '@svton/ui';
import { FlowStatusTag } from './release-flow-status-tag';
import type { ReleaseEvidenceProductionRun } from '../../types/release-order-evidence.types';
import { releaseApprovalStatusLabelKey, releaseExecutionStatusLabelKey } from '../../utils/release-copy.model';
import { shortDigest, shortTechnicalId } from '../../utils/release-display.utils';
import { formatIso } from '../../utils/release-time.utils';

interface Props {
  run: ReleaseEvidenceProductionRun | null;
  onClose: () => void;
}

const MAX_LOG_LENGTH = 12_000;

export function ReleaseProductionRunLogDrawer(props: Props) {
  const t = useTranslations('projects');
  const tc = useTranslations('common');
  const run = props.run;

  return (
    <Drawer
      open={Boolean(run)}
      onClose={props.onClose}
      title={t('releaseProductionLogTitle', { id: run ? shortTechnicalId(run.id) : '—' })}
      width="min(760px, 100vw)"
      ariaCloseLabel={tc('close')}
    >
      {run ? (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <FlowStatusTag
              status={run.status.toLowerCase()}
              label={t(releaseExecutionStatusLabelKey(run.status))}
            />
            <span className="text-xs text-muted-foreground">
              {t('releaseApprovalStatus')}：
              <FlowStatusTag
                status={run.operationApproval.status.toLowerCase()}
                label={t(releaseApprovalStatusLabelKey(run.operationApproval.status))}
              />
            </span>
            <span className="text-xs text-muted-foreground">{formatIso(run.createdAt)}</span>
          </div>
          <dl className="grid gap-2 text-sm sm:grid-cols-2">
            <Fact
              label={t('productionArtifact')}
              value={shortDigest(run.manifest.digest)}
              title={run.manifest.digest}
              mono
            />
            <Fact
              label={t('releaseBuildRevisionLabel')}
              value={`#${run.manifest.buildRun.revision}`}
            />
            {run.stagingProof ? (
              <Fact
                label={t('releaseProductionStagingProofLabel')}
                value={shortTechnicalId(run.stagingProof.deploymentRunId)}
                title={run.stagingProof.deploymentRunId}
                mono
              />
            ) : null}
            <Fact
              label={t('releaseBuildEnvironment')}
              value={run.environment.name}
            />
          </dl>
          {run.errorCode ? (
            <p className="rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive">
              {run.errorCode}: {run.errorMessage || t('releaseBuildUnavailable')}
            </p>
          ) : null}
          {run.deploymentRuns.map((deployment) => (
            <section
              key={deployment.id}
              className="rounded-md border p-3"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h4 className="text-sm font-medium">
                  DeploymentRun <span title={deployment.id}>{shortTechnicalId(deployment.id)}</span>
                </h4>
                <FlowStatusTag
                  status={deployment.status.toLowerCase()}
                  label={t(releaseExecutionStatusLabelKey(deployment.status))}
                />
              </div>
              <pre
                className="mt-2 max-h-72 overflow-auto whitespace-pre-wrap break-all rounded bg-muted p-3 font-mono text-xs"
                role="log"
              >
                {logs(deployment.logs) || t('releaseStagingLogsEmpty')}
              </pre>
            </section>
          ))}
        </div>
      ) : null}
    </Drawer>
  );
}

function Fact(props: { label: string; value: string; title?: string; mono?: boolean }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs text-muted-foreground">{props.label}</dt>
      <dd
        className={`mt-0.5 break-all ${props.mono ? 'font-mono text-xs' : 'text-sm'}`}
        title={props.title}
      >
        {props.value}
      </dd>
    </div>
  );
}

function logs(value: unknown) {
  const raw = Array.isArray(value)
    ? value.filter((item): item is string => typeof item === 'string').join('\n')
    : typeof value === 'string'
      ? value
      : '';
  if (!raw) return '';
  return raw.length > MAX_LOG_LENGTH ? `${raw.slice(0, MAX_LOG_LENGTH)}\n…` : raw;
}
