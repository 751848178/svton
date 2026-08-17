import {
  encodeModelKey,
  type ModelKey,
  type ModelSwitchHost,
} from '@svton/agent-client';
import type { BrowserPlatform } from '@svton/agent-platform';
import type { createAgentConfig } from '../lib/create-agent-config';
import { createAgentConfig as buildConfig } from '../lib/create-agent-config';
import type { DefaultSettingsAdapter } from '../lib/default-settings-adapter';
import type { AgentAppStorage } from '../lib/storage';

type ConfigOptions = Parameters<typeof createAgentConfig>[0];

export function createAgentAppModelSwitchHost(
  platform: BrowserPlatform,
  getOptions: () => ConfigOptions,
  adapter: DefaultSettingsAdapter,
  storage: AgentAppStorage,
  initialPersisted: ModelKey,
  build: typeof buildConfig = buildConfig,
): ModelSwitchHost {
  let persisted = initialPersisted;
  return {
    prepareConfig: async (request) => {
      const config = await build({
        ...getOptions(),
        model: encodeModelKey(request.to),
      });
      const preparedConfig = {
        ...config,
        reasoningEffort: request.reasoningEffort,
      };
      return {
        platform,
        config: preparedConfig,
        runtimeKey: encodeModelKey(request.to),
      };
    },
    persistDefault: async (key, prepared) => {
      storage.setString('defaultModel', encodeModelKey(key));
      persisted = key;
      adapter.setAgentConfig(prepared.config);
    },
    getPersisted: () => persisted,
  };
}
