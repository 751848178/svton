import type { AgentConfig } from '@svton/agent-core';
import type { IPlatform } from '@svton/agent-platform';
import type {
  ModelKey,
  ModelSwitchRequest,
} from './model-switch.types';

export interface PreparedModelConfig {
  config: AgentConfig;
  platform: IPlatform;
  runtimeKey?: string;
}

export interface ModelSwitchHost {
  prepareConfig: (request: ModelSwitchRequest) => Promise<PreparedModelConfig>;
  persistDefault: (key: ModelKey, prepared: PreparedModelConfig) => Promise<void>;
  getPersisted: () => ModelKey;
}
