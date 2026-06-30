/**
 * CDN 数据 Hook
 *
 * 单一职责：管理配置状态（useSetState）并并行生成 5 类 CDN 配置。
 */

import { useState } from 'react';
import { useSetState, usePersistFn } from '@svton/hooks';
import { apiRequest } from '@/lib/api-client';
import { DEFAULT_CDN_CONFIG } from '../constants';
import type { CDNConfig, CDNResults } from '../types';

export function useCdn() {
  const [config, setConfig] = useSetState<CDNConfig>(DEFAULT_CDN_CONFIG);
  const [results, setResults] = useState<CDNResults>({});

  const generate = usePersistFn(async () => {
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
    } catch (error) {
      console.error('Failed to generate CDN config:', error);
    }
  });

  return { config, setConfig, results, generate };
}
