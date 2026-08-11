'use client';

import React, { type ReactNode } from 'react';
import { useTranslations } from 'next-intl';
import type { ReleaseBuildItem, ReleaseStagingDeploymentItem } from '../types/release-order.types';
import { stagingBuildForRun } from '../utils/release-staging-view.model';
import { ReleaseStagingEvidenceRow as RunRow } from './release-staging-evidence-row';

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

export function ReleaseStagingEvidenceList(props: Props) {
  const t = useTranslations('projects');
  return (
    <div className="space-y-3">
      {props.total > props.items.length ? (
        <p className="text-xs text-muted-foreground">
          {t('releaseEvidenceHistoryLimited', { shown: props.items.length, total: props.total })}
        </p>
      ) : null}
      <div className="overflow-x-auto rounded-lg border">
        <table className="w-full min-w-[980px] table-fixed text-sm">
          <caption className="sr-only">{t('releaseStagingHistoryTable')}</caption>
          <colgroup>
            <col className="w-[18%]" />
            <col className="w-[25%]" />
            <col className="w-[14%]" />
            <col className="w-[18%]" />
            <col className="w-[14%]" />
            <col className="w-[11%]" />
          </colgroup>
          <thead className="bg-muted/50 text-left">
            <tr>
              <Header>{t('releaseStagingColumnRun')}</Header>
              <Header>{t('releaseStagingColumnArtifact')}</Header>
              <Header>{t('releaseStagingColumnResult')}</Header>
              <Header>{t('releaseStagingColumnVerification')}</Header>
              <Header>{t('releaseBuildColumnDurationTime')}</Header>
              <Header>{t('releaseBuildColumnActions')}</Header>
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
      </div>
    </div>
  );
}

function Header({ children }: { children: ReactNode }) {
  return (
    <th
      scope="col"
      className="px-4 py-3 font-medium"
    >
      {children}
    </th>
  );
}
