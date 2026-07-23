/**
 * CDN 数据 Hook
 *
 * 单一职责：管理配置状态（useSetState）并并行生成 5 类 CDN 配置。
 */

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { useSetState, usePersistFn } from '@svton/hooks';
import { apiRequest } from '@/lib/api-client';
import { DEFAULT_CDN_CONFIG } from '../constants';
import type { CDNConfig, CDNResults } from '../types';

export function useCdn() {
  const t = useTranslations('cdn');
  const [config, setConfig] = useSetState<CDNConfig>(DEFAULT_CDN_CONFIG);
  const [results, setResults] = useState<CDNResults>({});
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState('');

  const generate = usePersistFn(async () => {
    setGenerating(true);
    setError('');
    try {
      const [urlConfig, frontendConfig, refreshScript, nextjsConfig, envConfig] = await Promise.all(
        [
          apiRequest<Record<string, string>>('POST:/cdn/url-config', config),
          apiRequest<{ content: string }>('POST:/cdn/frontend-config', config),
          apiRequest<{ content: string }>('POST:/cdn/refresh-script', config),
          apiRequest<{ content: string }>('POST:/cdn/nextjs-config', config),
          apiRequest<{ content: string }>('POST:/cdn/env-config', config),
        ],
      );
      setResults({
        urlConfig,
        frontendConfig: frontendConfig.content,
        refreshScript: refreshScript.content,
        nextjsConfig: nextjsConfig.content,
        envConfig: envConfig.content,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : t('generateFailed'));
    } finally {
      setGenerating(false);
    }
  });

  const clearError = usePersistFn(() => setError(''));

  return { config, setConfig, results, generate, generating, error, clearError };
}

