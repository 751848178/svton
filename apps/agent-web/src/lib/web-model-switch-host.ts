import { encodeModelKey, type ModelKey, type ModelSwitchHost } from '@svton/agent-client';
import type { BrowserPlatform } from '@svton/agent-platform';
import { initAgentConfig } from './agent-setup';
import { LS_DEFAULT_MODEL, saveString } from './settings-store';
import {
  applyE2eModelPrepareBehavior,
  consumeE2eModelPersistenceFailure,
} from './e2e-model-switch';

export function createWebModelSwitchHost(
  platform: BrowserPlatform,
  initialPersisted: ModelKey,
): ModelSwitchHost {
  let persisted = initialPersisted;
  return {
    prepareConfig: async (request) => {
      await applyE2eModelPrepareBehavior(request.to);
      return {
        platform,
        config: {
          ...await initAgentConfig(encodeModelKey(request.to), platform),
          reasoningEffort: request.reasoningEffort,
        },
        runtimeKey: encodeModelKey(request.to),
      };
    },
    persistDefault: async (key) => {
      consumeE2eModelPersistenceFailure();
      saveString(LS_DEFAULT_MODEL, encodeModelKey(key));
      persisted = key;
    },
    getPersisted: () => persisted,
  };
}
