/**
 * 生产发布记录表（串行链路第二节点的运行历史）：
 * ReleaseRun 状态 / 审批 / 制品 / 时间 + 项目列表式操作列（查看日志）。
 */
'use client';

import React, { type ReactNode } from 'react';
import { useTranslations } from 'next-intl';
import { FlowStatusTag } from './release-flow-status-tag';
import type { ReleaseEvidenceProductionRun } from '../../types/release-order-evidence.types';
import {
  releaseApprovalStatusLabelKey,
  releaseExecutionStatusLabelKey,
} from '../../utils/release-copy.model';
import { shortDigest, shortTechnicalId } from '../../utils/release-display.utils';
import { formatIso } from '../../utils/release-time.utils';
import { ReleaseOrderActions } from '../release-order-actions';

interface Props {
  runs: ReleaseEvidenceProductionRun[];
  focusedRunId?: string;
  onOpenLog: (runId: string) => void;
}

export function ReleaseProductionRunHistory(props: Props) {
  const t = useTranslations('projects');
  const runs = [...props.runs].sort(
    (left, right) => Date.parse(right.createdAt) - Date.parse(left.createdAt),
  );

  return (
    <div className="overflow-x-auto rounded-lg border">
      <table className="w-full min-w-[820px] table-fixed text-sm">
        <caption className="sr-only">{t('releaseProductionRunHistoryTitle')}</caption>
        <colgroup>
          <col className="w-[24%]" />
          <col className="w-[14%]" />
          <col className="w-[20%]" />
          <col className="w-[24%]" />
          <col className="w-[18%]" />
        </colgroup>
        <thead className="bg-muted/50 text-left">
          <tr>
            <Header>{t('releaseProductionColumnRun')}</Header>
            <Header>{t('releaseProductionColumnStatus')}</Header>
            <Header>{t('releaseProductionColumnApproval')}</Header>
            <Header>{t('productionArtifact')}</Header>
            <Header className="text-right">{t('releaseBuildColumnActions')}</Header>
          </tr>
        </thead>
        <tbody className="divide-y">
          {runs.map((run) => (
            <tr
              key={run.id}
              className={run.id === props.focusedRunId ? 'bg-primary/5' : undefined}
              aria-current={run.id === props.focusedRunId ? 'true' : undefined}
            >
              <Cell>
                <span
                  className="block truncate font-semibold"
                  title={run.id}
                >
                  ReleaseRun {shortTechnicalId(run.id)}
                </span>
                <time
                  className="block text-xs text-muted-foreground"
                  dateTime={run.createdAt}
                >
                  {formatIso(run.createdAt)}
                </time>
              </Cell>
              <Cell>
                <FlowStatusTag
                  status={run.status.toLowerCase()}
                  label={t(releaseExecutionStatusLabelKey(run.status))}
                />
              </Cell>
              <Cell>
                <FlowStatusTag
                  status={run.operationApproval.status.toLowerCase()}
                  label={t(releaseApprovalStatusLabelKey(run.operationApproval.status))}
                />
                <span
                  className="mt-1 block truncate text-xs text-muted-foreground"
                  title={run.operationApproval.reviewer?.name ?? ''}
                >
                  {run.operationApproval.reviewer?.name ?? run.operationApproval.requester?.name ?? ''}
                </span>
              </Cell>
              <Cell>
                <code
                  className="block truncate font-mono text-xs"
                  title={run.manifest.digest}
                >
                  {shortDigest(run.manifest.digest)}
                </code>
                <span className="block text-xs text-muted-foreground">
                  {t('releaseBuildRevision', { revision: run.manifest.buildRun.revision })}
                </span>
              </Cell>
              <Cell className="text-right">
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
              </Cell>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Header({ children, className }: { children: ReactNode; className?: string }) {
  return <th scope="col" className={`px-4 py-3 font-medium ${className ?? ''}`}>{children}</th>;
}

function Cell({ children, className }: { children: ReactNode; className?: string }) {
  return <td className={`px-4 py-3 align-top ${className ?? ''}`}>{children}</td>;
}
