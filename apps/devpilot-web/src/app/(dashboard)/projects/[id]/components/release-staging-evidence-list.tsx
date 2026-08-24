'use client';

import React, { type ReactNode } from 'react';
import { useTranslations } from 'next-intl';
import type { ReleaseBuildItem, ReleaseStagingDeploymentItem } from '../types/release-order.types';
import { stagingBuildForRun } from '../utils/release-staging-view.model';
import { ReleaseStagingEvidenceRow as RunRow } from './release-staging-evidence-row';
import { ReleaseScrollTable } from './release-workbench/release-scroll-table';

interface Props {
  items: ReleaseStagingDeploymentItem[];
  builds: ReleaseBuildItem[];
  total: number;
  focusedRunId?: string;
  deploying: boolean;
  deploymentAllowed?: boolean;
  onOpenLog: (runId: string) => void;
  onDeploy: (manifestId: string) => void;
}

/**
 * PX-5：去掉固定最小宽度，短 ID 化后表格在抽屉内自适应，
 * 「操作」列（日志/部署）不再被裁出视口。
 */
export function ReleaseStagingEvidenceList(props: Props) {
  const t = useTranslations('projects');
  return (
    <div className="space-y-3">
      {props.total > props.items.length ? (
        <p className="text-xs text-muted-foreground">
          {t('releaseEvidenceHistoryLimited', { shown: props.items.length, total: props.total })}
        </p>
      ) : null}
      <ReleaseScrollTable>
        <table className="w-full table-fixed text-sm">
          <caption className="sr-only">{t('releaseStagingHistoryTable')}</caption>
          <colgroup>
            <col className="w-[16%]" />
            <col className="w-[19%]" />
            <col className="w-[13%]" />
            <col className="w-[22%]" />
            <col className="w-[16%]" />
            <col className="w-[14%]" />
          </colgroup>
          <thead className="bg-muted/50 text-left">
            <tr>
              <Header>{t('releaseStagingColumnRun')}</Header>
              <Header>{t('releaseStagingColumnArtifact')}</Header>
              <Header>{t('releaseStagingColumnResult')}</Header>
              <Header>{t('releaseStagingColumnVerification')}</Header>
              <Header>{t('releaseBuildColumnDurationTime')}</Header>
              <Header className="text-right">{t('releaseBuildColumnActions')}</Header>
            </tr>
          </thead>
          <tbody className="divide-y">
            {props.items.map((run) => (
              <RunRow
                key={run.id}
                run={run}
                build={stagingBuildForRun(run, props.builds)}
                focused={run.id === props.focusedRunId}
                deploying={props.deploying}
                deploymentAllowed={props.deploymentAllowed}
                onOpenLog={props.onOpenLog}
                onDeploy={props.onDeploy}
              />
            ))}
          </tbody>
        </table>
      </ReleaseScrollTable>
    </div>
  );
}

function Header({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <th
      scope="col"
      className={`px-3 py-3 font-medium ${className ?? ''}`}
    >
      {children}
    </th>
  );
}
