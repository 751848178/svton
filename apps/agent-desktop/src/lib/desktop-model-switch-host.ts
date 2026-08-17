import {
  encodeModelKey,
  type ModelKey,
  type ModelSwitchHost,
} from '@svton/agent-client';
import type { TauriPlatform } from '@svton/agent-platform';
import { initAgent } from './agent-setup';
import { loadConfig, saveConfig } from './config-store';

export function createDesktopModelSwitchHost(
  platform: TauriPlatform,
  initialPersisted: ModelKey,
): ModelSwitchHost {
  let persisted = initialPersisted;
  return {
    prepareConfig: async (request) => {
      const result = await initAgent(platform, encodeModelKey(request.to));
      if (result.kind !== 'ready') {
        throw new Error(describeInitFailure(result));
      }
      return {
        platform,
        config: {
          ...result.config,
          reasoningEffort: request.reasoningEffort,
        },
        runtimeKey: encodeModelKey(request.to),
      };
    },
    persistDefault: async (key) => {
      const loaded = await loadConfig(platform);
      if (!loaded.config) throw new Error(loaded.error || '桌面配置文件不可用。');
      const provider = loaded.config.providers[key.providerId];
      if (!provider?.models || !(key.modelId in provider.models)) {
        throw new Error('模型不属于当前桌面 Provider 配置。');
      }
      await saveConfig(platform, {
        ...loaded.config,
        model: { provider: key.providerId, name: key.modelId },
      });
      persisted = key;
    },
    getPersisted: () => persisted,
  };
}

function describeInitFailure(
  result: Exclude<Awaited<ReturnType<typeof initAgent>>, { kind: 'ready' }>,
): string {
  if (result.kind === 'error') return result.message;
  if (result.kind === 'no_api_key') return '目标 Provider 尚未配置 API Key。';
  return '桌面配置文件尚未准备完成。';
}
