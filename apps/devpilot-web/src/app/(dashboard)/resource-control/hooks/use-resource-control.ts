/**
 * 资源管控数据 Hook
 *
 * 单一职责：加载受管资源/服务器/操作定义与运行记录、连接/查询运行。
 */

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { usePersistFn } from '@svton/hooks';
import { apiRequest } from '@/lib/api-client';
import type {
  Server,
  ManagedResource,
  ExecuteResourceActionRequest,
  ResourceActionDefinition,
  ResourceActionRunInput,
  ResourceActionRunOptions,
  ResourceActionRun,
} from '../types';
import type { ResourceConnectionRun, ResourceQueryRun } from '../types-query';

const CLOUD_SYNC_PROVIDERS = ['aliyun-rds', 'aliyun-sls', 'tencent-cos'] as const;

function resolveCloudSyncProvider(provider: string) {
  return CLOUD_SYNC_PROVIDERS.includes(provider as (typeof CLOUD_SYNC_PROVIDERS)[number])
    ? provider
    : 'all';
}

function buildResourceSyncRequest(resource: ManagedResource) {
  const environmentId = resource.environment?.id;

  if (resource.sourceType === 'server') {
    if (!resource.serverId) {
      // 抛 i18n key，由调用处 catch 用 t 解析
      throw new Error('syncMissingServerId');
    }
    return {
      endpoint: `POST:/resource-control/servers/${resource.serverId}/sync-docker`,
      body: {
        environmentId,
        includeContainers: true,
        includeMiddleware: true,
      },
    };
  }

  if (resource.sourceType === 'cloud') {
    return {
      endpoint: 'POST:/resource-control/cloud/sync',
      body: {
        provider: resolveCloudSyncProvider(resource.provider),
        credentialId: resource.credential?.id,
        environmentId,
      },
    };
  }

  throw new Error('syncUnsupportedType');
}

export function useResourceControl() {
  const t = useTranslations('resourceControl');
  const [servers, setServers] = useState<Server[]>([]);
  const [resources, setResources] = useState<ManagedResource[]>([]);
  const [actions, setActions] = useState<ResourceActionDefinition[]>([]);
  const [actionRuns, setActionRuns] = useState<ResourceActionRun[]>([]);
  const [connectionRuns, setConnectionRuns] = useState<ResourceConnectionRun[]>([]);
  const [queryRuns, setQueryRuns] = useState<ResourceQueryRun[]>([]);
  const [loading, setLoading] = useState(true);
  const [actingResourceId, setActingResourceId] = useState('');
  const [error, setError] = useState('');
  const [filterProvider, setFilterProvider] = useState('');
  const [filterKind, setFilterKind] = useState('');
  const [filterStatus, setFilterStatus] = useState('');

  /** 解析错误：命中的 i18n key 翻译，否则回退动态 err.message，再否则用默认 key。 */
  const resolveError = usePersistFn((err: unknown, fallbackKey: string): string => {
    if (err instanceof Error && err.message && t.has(err.message)) return t(err.message);
    if (err instanceof Error && err.message) return err.message;
    return t(fallbackKey);
  });

  const loadData = usePersistFn(async () => {
    setError('');
    try {
      const [res, actionDefs, srv, actionRuns, conns, queries] = await Promise.all([
        apiRequest<ManagedResource[]>('GET:/resource-control/resources'),
        apiRequest<ResourceActionDefinition[]>('GET:/resource-control/actions'),
        apiRequest<Server[]>('GET:/servers'),
        apiRequest<ResourceActionRun[]>('GET:/resource-control/action-runs'),
        apiRequest<ResourceConnectionRun[]>('GET:/resource-control/connection-runs'),
        apiRequest<ResourceQueryRun[]>('GET:/resource-control/query-runs'),
      ]);
      setResources(res);
      setActions(actionDefs);
      setServers(srv);
      setActionRuns(actionRuns);
      setConnectionRuns(conns);
      setQueryRuns(queries);
    } catch (err) {
      setError(resolveError(err, 'loadDataFailed'));
    } finally {
      setLoading(false);
    }
  });

  useEffect(() => {
    loadData();
  }, [loadData]);

  const runAction = usePersistFn(
    async (
      resource: ManagedResource,
      action: ResourceActionRunInput,
      options: ResourceActionRunOptions = {},
    ) => {
      const actionKey = typeof action === 'string' ? action : action.key;
      const request: ExecuteResourceActionRequest = {
        action: actionKey,
        dryRun: options.dryRun ?? true,
      };
      if (options.queue !== undefined) request.queue = options.queue;
      if (options.maxAttempts !== undefined) request.maxAttempts = options.maxAttempts;
      if (options.confirmationText !== undefined)
        request.confirmationText = options.confirmationText;
      if (options.approvalId !== undefined) request.approvalId = options.approvalId;

      setActingResourceId(`${resource.id}:${actionKey}`);
      setError('');
      try {
        await apiRequest(`POST:/resource-control/resources/${resource.id}/actions`, {
          ...request,
        });
        await loadData();
      } catch (err) {
        setError(resolveError(err, 'runActionFailed'));
      } finally {
        setActingResourceId('');
      }
    },
  );

  const syncResource = usePersistFn(async (resource: ManagedResource) => {
    setActingResourceId(`${resource.id}:sync`);
    setError('');
    try {
      const request = buildResourceSyncRequest(resource);
      await apiRequest(request.endpoint, request.body);
      await loadData();
    } catch (err) {
      setError(resolveError(err, 'syncFailed'));
    } finally {
      setActingResourceId('');
    }
  });

  return {
    servers,
    resources,
    actions,
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
