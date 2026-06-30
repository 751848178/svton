/**
 * 资源管控数据 Hook
 *
 * 单一职责：加载受管资源/服务器/凭证/环境/指标/操作运行。
 */

import { useEffect, useState } from 'react';
import { usePersistFn } from '@svton/hooks';
import { apiRequest } from '@/lib/api-client';
import type {
  Server,
  ManagedResource,
  ProjectEnvironment,
  TeamCredential,
  ResourceActionRun,
} from '../types';
import type { ResourceConnectionRun, ResourceQueryRun } from '../types-query';

export function useResourceControl() {
  const [servers, setServers] = useState<Server[]>([]);
  const [resources, setResources] = useState<ManagedResource[]>([]);
  const [environments, setEnvironments] = useState<ProjectEnvironment[]>([]);
  const [credentials, setCredentials] = useState<TeamCredential[]>([]);
  const [actionRuns, setActionRuns] = useState<ResourceActionRun[]>([]);
  const [connectionRuns, setConnectionRuns] = useState<ResourceConnectionRun[]>([]);
  const [queryRuns, setQueryRuns] = useState<ResourceQueryRun[]>([]);
  const [loading, setLoading] = useState(true);
  const [actingResourceId, setActingResourceId] = useState('');
  const [error, setError] = useState('');
  const [filterProvider, setFilterProvider] = useState('');
  const [filterKind, setFilterKind] = useState('');
  const [filterStatus, setFilterStatus] = useState('');

  const loadData = usePersistFn(async () => {
    setError('');
    try {
      const [res, srv, env, cred, actions, conns, queries] = await Promise.all([
        apiRequest<ManagedResource[]>('GET:/resource-control/resources'),
        apiRequest<Server[]>('GET:/servers'),
        apiRequest<ProjectEnvironment[]>('GET:/project-environments'),
        apiRequest<TeamCredential[]>('GET:/team-credentials'),
        apiRequest<ResourceActionRun[]>('GET:/resource-control/action-runs'),
        apiRequest<ResourceConnectionRun[]>('GET:/resource-control/connection-runs'),
        apiRequest<ResourceQueryRun[]>('GET:/resource-control/query-runs'),
      ]);
      setResources(res);
      setServers(srv);
      setEnvironments(env);
      setCredentials(cred);
      setActionRuns(actions);
      setConnectionRuns(conns);
      setQueryRuns(queries);
    } catch (err) {
      setError(err instanceof Error ? err.message : '加载资源管控数据失败');
    } finally {
      setLoading(false);
    }
  });

  useEffect(() => {
    loadData();
  }, [loadData]);

  const runAction = usePersistFn(async (resource: ManagedResource, actionKey: string) => {
    setActingResourceId(`${resource.id}:${actionKey}`);
    setError('');
    try {
      await apiRequest(`POST:/resource-control/resources/${resource.id}/actions`, {
        action: actionKey,
        dryRun: true,
      });
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : '执行资源动作失败');
    } finally {
      setActingResourceId('');
    }
  });

  const syncResource = usePersistFn(async (resource: ManagedResource) => {
    setActingResourceId(`${resource.id}:sync`);
    setError('');
    try {
      await apiRequest(`POST:/resource-control/resources/${resource.id}/sync`);
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : '同步资源失败');
    } finally {
      setActingResourceId('');
    }
  });

  return {
    servers,
    resources,
    environments,
    credentials,
    actionRuns,
    connectionRuns,
    queryRuns,
    loading,
    actingResourceId,
    error,
    filterProvider,
    setFilterProvider,
    filterKind,
    setFilterKind,
    filterStatus,
    setFilterStatus,
    loadData,
    runAction,
    syncResource,
  };
}
