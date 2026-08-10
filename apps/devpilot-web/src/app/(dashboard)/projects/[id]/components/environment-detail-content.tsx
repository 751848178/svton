/**
 * 环境详情内容。
 *
 * 单一职责：渲染某个环境的服务器、资源、变量、复制/同步、部署画像等详情。
 * 该内容可被抽屉或主从详情面板复用，避免“列表页只能弹抽屉”的交互绑定。
 */
'use client';

import { useEffect, useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import { buildEnvironmentConfigProfiles } from '../utils/deployment-config';
import { ConfigProfile, LastDeployment } from './environment-detail-derived';
import { BoundServers, EnvBasics, ResourceCounts } from './environment-detail-sections';
import { EnvironmentEnvVarsSection } from './environment-env-vars-section';
import { EnvironmentWriteActions } from './environment-write-actions';
import { EnvironmentCopyPanel } from './environment-copy-panel';
import { EnvironmentSyncPanel } from './environment-sync-panel';
import { EnvironmentConfigGovernanceSection } from './environment-config-governance-section';
import type { DeploymentRun } from '../types/operations';
import type { Project, ProjectEnvironment } from '../types';

interface EnvironmentDetailContentProps {
  environment: ProjectEnvironment;
  project: Project;
  deploymentRuns: DeploymentRun[];
  onEnvironmentSaved?: () => void;
}

export function EnvironmentDetailContent({
  environment,
  project,
  deploymentRuns,
  onEnvironmentSaved,
}: EnvironmentDetailContentProps) {
  const t = useTranslations('projects');
  const [current, setCurrent] = useState(environment);

  useEffect(() => {
    setCurrent(environment);
  }, [environment]);

  const handleEnvSaved = (updated: ProjectEnvironment) => {
    setCurrent(updated);
    onEnvironmentSaved?.();
  };
  const reload = onEnvironmentSaved ?? (() => {});

  const profile = useMemo(
    () =>
      buildEnvironmentConfigProfiles(project, deploymentRuns, project.environments ?? []).find(
        (p) => p.environment.id === current.id,
      ) ?? null,
    [current.id, project, deploymentRuns],
  );

  const lastRun = useMemo(() => {
    const runs = deploymentRuns.filter(
      (r) => r.projectEnvironment?.id === current.id || r.environment === current.key,
    );
    return runs[0] ?? null;
  }, [current, deploymentRuns]);

  return (
    <div className="space-y-5">
      <EnvBasics
        environment={current}
        t={t}
      />
      <BoundServers
        environment={current}
        t={t}
      />
      <EnvironmentWriteActions
        environment={current}
        onSaved={handleEnvSaved}
      />
      {current.status !== 'archived' ? (
        <>
          <EnvironmentCopyPanel
            environment={current}
            project={project}
            onChanged={reload}
          />
          <EnvironmentSyncPanel
            environment={current}
            project={project}
            onChanged={reload}
          />
        </>
      ) : null}
      <ResourceCounts
        environment={current}
        t={t}
      />
      <EnvironmentConfigGovernanceSection
        environment={current}
        project={project}
        onSaved={handleEnvSaved}
      />
      <EnvironmentEnvVarsSection
        environment={current}
        project={project}
        onSaved={handleEnvSaved}
      />
      {profile ? (
        <ConfigProfile
          profile={profile}
          t={t}
        />
      ) : null}
      <LastDeployment
        run={lastRun}
        t={t}
      />
    </div>
  );
}
