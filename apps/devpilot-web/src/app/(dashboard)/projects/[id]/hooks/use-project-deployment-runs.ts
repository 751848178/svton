'use client';

import { useEffect, useMemo, useState } from 'react';
import { usePersistFn } from '@svton/hooks';
import { apiRequest } from '@/lib/api-client';
import type { DeploymentRun } from '../types/operations';

export const PROJECT_DEPLOYMENT_PAGE_SIZE = 20;

export interface ProjectDeploymentRunFilters {
  environmentId: string;
  status: string;
  releaseOrderId: string;
  startedFrom: string;
  startedTo: string;
}

export const EMPTY_DEPLOYMENT_FILTERS: ProjectDeploymentRunFilters = {
  environmentId: '',
  status: '',
  releaseOrderId: '',
  startedFrom: '',
  startedTo: '',
};

export function useProjectDeploymentRuns(
  projectId: string,
  filters: ProjectDeploymentRunFilters,
  page: number,
) {
  const [runs, setRuns] = useState<DeploymentRun[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const query = useMemo(
    () => deploymentRunQuery(projectId, filters, page),
    [filters, page, projectId],
  );

  const load = usePersistFn(async () => {
    setLoading(true);
    try {
      try {
        setRuns(await apiRequest<DeploymentRun[]>('GET:/deployments/runs', query));
      } catch (requestError) {
        if (!isLegacyDeploymentQueryError(requestError)) throw requestError;
        const legacyRuns = await apiRequest<DeploymentRun[]>('GET:/deployments/runs', {
          projectId,
          ...(filters.status ? { status: filters.status } : {}),
          ...(filters.releaseOrderId ? { releaseOrderId: filters.releaseOrderId } : {}),
        });
        const filtered = filterLegacyDeploymentRuns(legacyRuns, filters);
        const start = Math.max(0, page) * PROJECT_DEPLOYMENT_PAGE_SIZE;
        setRuns(filtered.slice(start, start + PROJECT_DEPLOYMENT_PAGE_SIZE + 1));
      }
      setError('');
    } catch (loadError) {
      setRuns([]);
      setError(loadError instanceof Error ? loadError.message : String(loadError));
    } finally {
      setLoading(false);
    }
  });

  useEffect(() => {
    load();
  }, [load, query]);

  const hasActiveRun = runs.some((run) => ['queued', 'running', 'blocked'].includes(run.status));
  useEffect(() => {
    if (!hasActiveRun) return;
    const timer = window.setInterval(load, 5000);
    return () => window.clearInterval(timer);
  }, [hasActiveRun, load]);

  return {
    items: runs.slice(0, PROJECT_DEPLOYMENT_PAGE_SIZE),
    hasNext: runs.length > PROJECT_DEPLOYMENT_PAGE_SIZE,
    loading,
    error,
    reload: load,
  };
}

export function isLegacyDeploymentQueryError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  return /property (skip|take|environmentId|startedFrom|startedTo|attentionFirst) should not exist/.test(
    message,
  );
}

function filterLegacyDeploymentRuns(runs: DeploymentRun[], filters: ProjectDeploymentRunFilters) {
  const from = filters.startedFrom ? Date.parse(`${filters.startedFrom}T00:00:00.000Z`) : null;
  const to = filters.startedTo ? Date.parse(`${filters.startedTo}T23:59:59.999Z`) : null;
  return runs.filter((run) => {
    if (filters.environmentId && run.projectEnvironment?.id !== filters.environmentId) return false;
    const startedAt = Date.parse(run.startedAt);
    if (from !== null && startedAt < from) return false;
    if (to !== null && startedAt > to) return false;
    return true;
  });
}

export async function loadProjectDeploymentRun(projectId: string, runId: string) {
  return apiRequest<DeploymentRun>(
    `GET:/deployments/runs/${encodeURIComponent(runId)}?projectId=${encodeURIComponent(projectId)}`,
  );
}

export function deploymentRunQuery(
  projectId: string,
  filters: ProjectDeploymentRunFilters,
  page: number,
) {
  return {
    projectId,
    ...(filters.environmentId ? { environmentId: filters.environmentId } : {}),
    ...(filters.status ? { status: filters.status } : {}),
    ...(filters.releaseOrderId ? { releaseOrderId: filters.releaseOrderId } : {}),
    ...(filters.startedFrom ? { startedFrom: `${filters.startedFrom}T00:00:00.000Z` } : {}),
    ...(filters.startedTo ? { startedTo: `${filters.startedTo}T23:59:59.999Z` } : {}),
    attentionFirst: true,
    skip: Math.max(0, page) * PROJECT_DEPLOYMENT_PAGE_SIZE,
    take: PROJECT_DEPLOYMENT_PAGE_SIZE + 1,
  };
}
