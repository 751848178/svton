/**
 * 代理配置详情数据 Hook
 *
 * 单一职责：加载配置、同步、预览、删除。
 */

import { useEffect, useState } from 'react';
import { usePersistFn } from '@svton/hooks';
import { apiRequest } from '@/lib/api-client';
import type { ProxyConfig } from '../types';

export function useProxyConfig(configId: string) {
  const [config, setConfig] = useState<ProxyConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);

  const load = usePersistFn(async () => {
    try {
      setConfig(await apiRequest<ProxyConfig>(`GET:/proxy-configs/${configId}`));
    } catch (error) {
      console.error('Failed to load config:', error);
    } finally {
      setLoading(false);
    }
  });

  useEffect(() => {
    load();
  }, [configId, load]);

  const sync = usePersistFn(async () => {
    setSyncing(true);
    try {
      await apiRequest(`POST:/proxy-configs/${configId}/sync`);
      await load();
      alert('同步成功');
    } catch (error) {
      console.error('Sync failed:', error);
      alert('同步失败');
    } finally {
      setSyncing(false);
    }
  });

  const preview = usePersistFn(async () => {
    try {
      const result = await apiRequest<{ config: string }>(`GET:/proxy-configs/${configId}/preview`);
      return result.config;
    } catch (error) {
      console.error('Preview failed:', error);
      return null;
    }
  });

  const remove = usePersistFn(async () => {
    await apiRequest(`DELETE:/proxy-configs/${configId}`);
  });

  return { config, loading, syncing, sync, preview, remove, reload: load };
}
