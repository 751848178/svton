/**
 * CDN 配置数据 Hook
 *
 * 单一职责：CDN 配置与凭证的加载、新增、删除、缓存清除。
 *
 * 两个列表各自走 SWR（useQueryLoose），支持首屏 server 数据透传（fallback）；
 * 写操作后调用 mutate 刷新对应缓存。
 */

import { useState } from 'react';
import { usePersistFn } from '@svton/hooks';
import { apiRequest } from '@/lib/api-client';
import { useQueryLoose, mutate } from '@/hooks/api/use-api';
import type { CDNConfig, TeamCredential, CDNConfigInput, CredentialInput } from '../types';

/** SWR 缓存 key（与 useQueryLoose 的 apiName 一致）。 */
const CONFIGS_KEY = 'GET:/cdn-configs';
const CREDENTIALS_KEY = 'GET:/team-credentials';

export function useCdnConfigs(initialConfigs?: CDNConfig[], initialCredentials?: TeamCredential[]) {
  const {
    data: configsData,
    isLoading: configsLoading,
  } = useQueryLoose<CDNConfig[]>(CONFIGS_KEY, { fallback: initialConfigs });
  const {
    data: credentialsData,
    isLoading: credentialsLoading,
  } = useQueryLoose<TeamCredential[]>(CREDENTIALS_KEY, { fallback: initialCredentials });
  const configs = configsData ?? [];
  const credentials = credentialsData ?? [];
  const loading = configsLoading || credentialsLoading;
  const [purgingId, setPurgingId] = useState<string | null>(null);

  const createConfig = usePersistFn(async (input: CDNConfigInput) => {
    await apiRequest('POST:/cdn-configs', input);
    await mutate(CONFIGS_KEY);
  });

  const createCredential = usePersistFn(async (input: CredentialInput) => {
    await apiRequest('POST:/team-credentials', {
      name: input.name,
      type: input.type,
      config: { accessKey: input.accessKey, secretKey: input.secretKey },
    });
    await mutate(CREDENTIALS_KEY);
  });

  const purge = usePersistFn(async (id: string) => {
    setPurgingId(id);
    try {
      await apiRequest(`POST:/cdn-configs/${id}/purge`, {});
      alert('缓存清除请求已发送');
    } catch (error) {
      console.error('Purge failed:', error);
      alert('缓存清除失败');
    } finally {
      setPurgingId(null);
    }
  });

  const removeConfig = usePersistFn(async (id: string) => {
    if (!confirm('确定要删除这个 CDN 配置吗？')) return;
    await apiRequest(`DELETE:/cdn-configs/${id}`);
    await mutate(CONFIGS_KEY);
  });

  const removeCredential = usePersistFn(async (id: string) => {
    if (!confirm('确定要删除这个凭证吗？关联的 CDN 配置可能会受影响。')) return;
    await apiRequest(`DELETE:/team-credentials/${id}`);
    await mutate(CREDENTIALS_KEY);
  });

  const reload = usePersistFn(async () => {
    await Promise.all([mutate(CONFIGS_KEY), mutate(CREDENTIALS_KEY)]);
  });

  return {
    configs,
    credentials,
    loading,
    purgingId,
    createConfig,
    createCredential,
    purge,
    removeConfig,
    removeCredential,
    reload,
  };
}
