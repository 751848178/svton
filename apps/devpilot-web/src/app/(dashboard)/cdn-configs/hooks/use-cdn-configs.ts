/**
 * CDN 配置数据 Hook
 *
 * 单一职责：CDN 配置与凭证的加载、新增、删除、缓存清除。
 *
 * 两个列表各自走 SWR（useQueryLoose），支持首屏 server 数据透传（fallback）；
 * 写操作后调用 mutate 刷新对应缓存。
 */

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { usePersistFn } from '@svton/hooks';
import { apiRequest } from '@/lib/api-client';
import { feedback } from '@/components/ui/feedback/feedback';
import { useQueryLoose, mutate } from '@/hooks/api/use-api';
import type { CDNConfig, TeamCredential, CDNConfigInput, CredentialInput } from '../types';

/** SWR 缓存 key（与 useQueryLoose 的 apiName 一致）。 */
const CONFIGS_KEY = 'GET:/cdn-configs';
const CREDENTIALS_KEY = 'GET:/team-credentials';

export function useCdnConfigs(
  initialConfigs?: CDNConfig[],
  initialCredentials?: TeamCredential[],
  initialError?: string,
) {
  const t = useTranslations('cdnConfigs');
  const {
    data: configsData,
    isLoading: configsLoading,
    error: configsError,
  } = useQueryLoose<CDNConfig[]>(CONFIGS_KEY, { fallback: initialConfigs });
  const {
    data: credentialsData,
    isLoading: credentialsLoading,
    error: credentialsError,
  } = useQueryLoose<TeamCredential[]>(CREDENTIALS_KEY, { fallback: initialCredentials });
  const configs = configsData ?? [];
  const credentials = credentialsData ?? [];
  const loading = configsLoading || credentialsLoading;
  const swrError = configsError || credentialsError;
  const error = swrError
    ? swrError instanceof Error
      ? swrError.message
      : t('loadFailed')
    : initialError ?? '';
  const [purgingId, setPurgingId] = useState<string | null>(null);
  const [configTarget, setConfigTarget] = useState<CDNConfig | null>(null);
  const [credentialTarget, setCredentialTarget] = useState<TeamCredential | null>(null);

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
      feedback.success(t('purgeSuccess'));
    } catch (error) {
      feedback.error(t('purgeFailed'), {
        description: error instanceof Error ? error.message : undefined,
      });
    } finally {
      setPurgingId(null);
    }
  });

  const removeConfig = usePersistFn((id: string) => {
    setConfigTarget(configs.find((c) => c.id === id) ?? null);
  });

  const cancelRemoveConfig = usePersistFn(() => {
    setConfigTarget(null);
  });

  const confirmRemoveConfig = usePersistFn(async () => {
    if (!configTarget) return;
    try {
      await apiRequest(`DELETE:/cdn-configs/${configTarget.id}`);
      await mutate(CONFIGS_KEY);
      setConfigTarget(null);
      feedback.success(t('deleteSuccess'));
    } catch (error) {
      feedback.error(t('deleteFailed'), {
        description: error instanceof Error ? error.message : undefined,
      });
    }
  });

  const removeCredential = usePersistFn((id: string) => {
    setCredentialTarget(credentials.find((c) => c.id === id) ?? null);
  });

  const cancelRemoveCredential = usePersistFn(() => {
    setCredentialTarget(null);
  });

  const confirmRemoveCredential = usePersistFn(async () => {
    if (!credentialTarget) return;
    try {
      await apiRequest(`DELETE:/team-credentials/${credentialTarget.id}`);
      await mutate(CREDENTIALS_KEY);
      setCredentialTarget(null);
      feedback.success(t('deleteSuccess'));
    } catch (error) {
      feedback.error(t('deleteFailed'), {
        description: error instanceof Error ? error.message : undefined,
      });
    }
  });

  const reload = usePersistFn(async () => {
    await Promise.all([mutate(CONFIGS_KEY), mutate(CREDENTIALS_KEY)]);
  });

  return {
    configs,
    credentials,
    loading,
    error,
    purgingId,
    configTarget,
    credentialTarget,
    createConfig,
    createCredential,
    purge,
    removeConfig,
    cancelRemoveConfig,
    confirmRemoveConfig,
    removeCredential,
    cancelRemoveCredential,
    confirmRemoveCredential,
    reload,
  };
}
