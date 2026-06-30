/**
 * 代理配置列表数据 Hook
 *
 * 单一职责：代理配置与服务器列表加载、新增、同步、删除。
 *
 * 列表走 SWR（useQueryLoose），支持首屏 server 数据透传（fallback）；
 * 写操作后调用 mutate 刷新对应缓存。
 */

import { useState } from 'react';
import { usePersistFn } from '@svton/hooks';
import { apiRequest } from '@/lib/api-client';
import { useQueryLoose, mutate } from '@/hooks/api/use-api';
import type { ProxyConfig, Server, ProxyConfigInput } from '../types';

/** SWR 缓存 key（与 useQueryLoose 的 apiName 一致）。 */
const CONFIGS_KEY = 'GET:/proxy-configs';
const SERVERS_KEY = 'GET:/servers';

export function useProxyConfigs(openCreateOnMount: boolean, initialConfigs?: ProxyConfig[]) {
  const {
    data: configsData,
    isLoading: configsLoading,
  } = useQueryLoose<ProxyConfig[]>(CONFIGS_KEY, { fallback: initialConfigs });
  const { data: serversData, isLoading: serversLoading } = useQueryLoose<Server[]>(SERVERS_KEY);
  const configs = configsData ?? [];
  const servers = serversData ?? [];
  const loading = configsLoading || serversLoading;
  const [syncingId, setSyncingId] = useState<string | null>(null);

  const create = usePersistFn(async (input: ProxyConfigInput) => {
    await apiRequest('POST:/proxy-configs', {
      name: input.name,
      domain: input.domain,
      upstreams: [{ host: input.upstreamHost, port: input.upstreamPort }],
      ssl: { enabled: input.sslEnabled, type: input.sslEnabled ? input.sslType : 'none' },
      websocket: input.websocket,
      serverId: input.serverId || undefined,
    });
    await mutate(CONFIGS_KEY);
  });

  const sync = usePersistFn(async (id: string) => {
    setSyncingId(id);
    try {
      await apiRequest(`POST:/proxy-configs/${id}/sync`);
      await mutate(CONFIGS_KEY);
    } catch (error) {
      console.error('Sync failed:', error);
    } finally {
      setSyncingId(null);
    }
  });

  const remove = usePersistFn(async (id: string) => {
    if (!confirm('确定要删除这个代理配置吗？')) return;
    await apiRequest(`DELETE:/proxy-configs/${id}`);
    await mutate(CONFIGS_KEY);
  });

  const reload = usePersistFn(async () => {
    await Promise.all([mutate(CONFIGS_KEY), mutate(SERVERS_KEY)]);
  });

  return {
    configs,
    servers,
    loading,
    syncingId,
    openCreateOnMount,
    create,
    sync,
    remove,
    reload,
  };
}
