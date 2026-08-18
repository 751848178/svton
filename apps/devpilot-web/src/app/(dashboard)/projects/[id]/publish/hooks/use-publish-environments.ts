/**
 * 发布向导环境数据 Hook（第 0 步）
 *
 * 单一职责：为向导第一步「选环境」提供环境卡片数据 ——
 * GET /project-environments?projectId=（环境与角色）联查
 * GET /projects/:pid/delivery/environment-versions（当前版本与就绪状态）。
 * 界面只暴露名称/角色/当前版本/健康状态，不外泄内部键名与修订号。
 */

'use client';

import { useMemo } from 'react';
import useSWR from 'swr';
import { DEFAULT_SWR_CONFIG } from '@/hooks/api/use-api';
import { apiRequest } from '@/lib/api-client';
import { useAuthStore, useTeamStore } from '@/store/hooks';
import type { ProjectEnvironment } from '../../types';
import type { EnvironmentVersionsResponse } from '../../types/environment-version.types';

export interface PublishEnvironmentCard {
  id: string;
  /** 环境内部 key（仅用于拼装深链，不作为界面文案展示）。 */
  key: string;
  name: string;
  role: 'staging' | 'production' | null;
  currentVersion: string | null;
  healthy: boolean;
}

export function usePublishEnvironments(projectId: string) {
  const actorId = useAuthStore().user?.id ?? null;
  const teamId = useTeamStore().currentTeam?.id ?? null;
  const scopeReady = Boolean(actorId && teamId && projectId);

  const environmentsQuery = useSWR<ProjectEnvironment[]>(
    scopeReady ? ['publish-environments', actorId, teamId, projectId] : null,
    () =>
      apiRequest<ProjectEnvironment[]>(
        `GET:/project-environments?projectId=${encodeURIComponent(projectId)}`,
      ),
    DEFAULT_SWR_CONFIG,
  );
  const versionsQuery = useSWR<EnvironmentVersionsResponse>(
    scopeReady ? ['publish-environment-versions', actorId, teamId, projectId] : null,
    () =>
      apiRequest<EnvironmentVersionsResponse>(
        `GET:/projects/${encodeURIComponent(projectId)}/delivery/environment-versions`,
      ),
    DEFAULT_SWR_CONFIG,
  );

  const cards = useMemo(
    () => mergeEnvironmentCards(environmentsQuery.data ?? [], versionsQuery.data ?? null),
    [environmentsQuery.data, versionsQuery.data],
  );

  return {
    cards,
    loading: scopeReady && environmentsQuery.isLoading,
    error: errorMessage(environmentsQuery.error) || errorMessage(versionsQuery.error),
    reload: () => Promise.all([environmentsQuery.mutate(), versionsQuery.mutate()]),
  };
}

function mergeEnvironmentCards(
  environments: ProjectEnvironment[],
  versions: EnvironmentVersionsResponse | null,
): PublishEnvironmentCard[] {
  const versionByEnv = new Map(
    (versions?.environments ?? []).map((environment) => [environment.id, environment]),
  );
  return environments
    .filter((environment) => environment.status === 'active')
    .map((environment) => {
      const versionEnv = versionByEnv.get(environment.id) ?? null;
      const current = versionEnv?.currentEnvironmentVersionId
        ? (versionEnv.environmentVersions.find(
            (version) => version.id === versionEnv.currentEnvironmentVersionId,
          ) ?? null)
        : null;
      return {
        id: environment.id,
        key: environment.key,
        name: environment.name,
        role: environment.baselineRole ?? null,
        currentVersion: current?.releaseOrder.releaseVersion ?? null,
        healthy: versionEnv?.targetReadiness?.matchState === 'ready',
      };
    })
    .sort((left, right) => (left.role === right.role ? 0 : left.role === 'production' ? 1 : -1));
}

function errorMessage(error: unknown): string {
  return error ? (error instanceof Error ? error.message : String(error)) : '';
}
