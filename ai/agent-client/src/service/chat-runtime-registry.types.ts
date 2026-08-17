import type {
  AgentConfig,
  PermissionMode,
  ReasoningEffort,
  SvtonAgentRuntime,
} from '@svton/agent-core';
import type { IPlatform } from '@svton/agent-platform';
import type { ModelKey } from '../model-switch/model-switch.types';

export interface ChatRuntimeSlot {
  sessionId: string | null;
  runtime: SvtonAgentRuntime;
  configKey?: string;
  configRevision: number;
  model: string;
  modelKey: ModelKey | null;
  sessionScoped: boolean;
  config?: AgentConfig;
  platform?: IPlatform;
  reasoningEffort?: ReasoningEffort;
  permissionMode?: PermissionMode;
}

export interface PreparedRuntimeSwitch {
  sessionId: string | null;
  previous: ChatRuntimeSlot | null;
  runtime: SvtonAgentRuntime;
  config: AgentConfig;
  platform: IPlatform;
  configKey?: string;
  modelKey: ModelKey;
  disposed: boolean;
}

export class RuntimeCreationInvalidatedError extends Error {
  constructor(readonly reason: 'refresh' | 'delete') {
    super(`Runtime creation invalidated by ${reason}`);
  }
}
