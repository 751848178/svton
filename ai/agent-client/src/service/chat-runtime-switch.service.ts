import type { AgentConfig, SvtonAgentRuntime } from '@svton/agent-core';
import type { IPlatform } from '@svton/agent-platform';
import type { ModelKey } from '../model-switch/model-switch.types';
import { reseedRuntimeFromSnapshot, snapshotRuntimeMessages } from './chat-runtime-bridge';
import type {
  ChatRuntimeSlot,
  PreparedRuntimeSwitch,
} from './chat-runtime-registry.types';

type RuntimeFactory = (
  config: AgentConfig,
  platform: IPlatform,
  messages: [],
) => Promise<SvtonAgentRuntime>;

export async function prepareRuntimeSwitch(
  createRuntime: RuntimeFactory,
  sessionId: string | null,
  previous: ChatRuntimeSlot | null,
  platform: IPlatform,
  config: AgentConfig,
  modelKey: ModelKey,
  configKey?: string,
): Promise<PreparedRuntimeSwitch> {
  const snapshot = previous ? snapshotRuntimeMessages(previous.runtime) : null;
  const runtime = await createRuntime(config, platform, []);
  if (previous?.permissionMode) runtime.setPermissionMode(previous.permissionMode);
  if (snapshot) reseedRuntimeFromSnapshot(runtime, snapshot);
  return {
    sessionId,
    previous,
    runtime,
    config,
    platform,
    configKey,
    modelKey,
    disposed: false,
  };
}

export function disposeRuntimeSwitch(candidate: PreparedRuntimeSwitch): void {
  if (candidate.disposed) return;
  candidate.disposed = true;
  try {
    candidate.runtime.abort();
  } catch {
    // A prepared candidate is already detached; cleanup must remain best effort.
  }
  try {
    candidate.runtime.reset();
  } catch {
    // Reset failure cannot reject a superseded or blocked switch transaction.
  }
}

export function commitRuntimeSwitch(
  candidate: PreparedRuntimeSwitch,
  current: ChatRuntimeSlot | null,
  configRevision: number,
): ChatRuntimeSlot | null {
  if (candidate.disposed || current !== candidate.previous) {
    disposeRuntimeSwitch(candidate);
    return null;
  }
  const slot: ChatRuntimeSlot = {
    sessionId: candidate.sessionId,
    runtime: candidate.runtime,
    configKey: candidate.configKey,
    configRevision,
    model: candidate.config.model,
    modelKey: candidate.modelKey,
    sessionScoped: true,
    config: candidate.config,
    platform: candidate.platform,
    reasoningEffort: candidate.config.reasoningEffort,
    permissionMode: candidate.runtime.getPermissionMode?.(),
  };
  return slot;
}

export function completeRuntimeSwitchCommit(candidate: PreparedRuntimeSwitch): void {
  candidate.disposed = true;
  try {
    candidate.previous?.runtime.reset();
  } catch {
    // The addressed slot is already installed; cleanup cannot roll back the pointer commit.
  }
}
