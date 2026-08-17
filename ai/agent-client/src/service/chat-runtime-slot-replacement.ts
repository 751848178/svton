import type { AgentConfig, SvtonAgentRuntime } from '@svton/agent-core';
import type { IPlatform } from '@svton/agent-platform';
import type { ChatRuntimeSlot } from './chat-runtime-registry.types';
import { RuntimeCreationInvalidatedError } from './chat-runtime-registry.types';
import { reseedRuntimeFromSnapshot, snapshotRuntimeMessages } from './chat-runtime-bridge';

interface ReplacementBindings {
  current: () => ChatRuntimeSlot | undefined;
  config: () => AgentConfig | null;
  platform: () => IPlatform | null;
  configKey: () => string | undefined;
  configRevision: () => number;
  epoch: () => number;
  bumpEpoch: () => number;
  invalidation: () => 'refresh' | 'delete';
  create: (config: AgentConfig, platform: IPlatform, messages: []) => Promise<SvtonAgentRuntime>;
  install: (slot: ChatRuntimeSlot) => void;
  clearInvalidation: () => void;
}

export async function replaceRuntimeSlot(
  sessionId: string | null,
  bindings: ReplacementBindings,
): Promise<SvtonAgentRuntime> {
  for (;;) {
    const current = bindings.current();
    if (!current) throw new RuntimeCreationInvalidatedError('delete');
    if (current.sessionScoped) return current.runtime;
    const config = bindings.config();
    const configKey = bindings.configKey();
    const revision = bindings.configRevision();
    const sameConfig = configKey !== undefined
      ? current.configKey === configKey
      : current.configRevision === revision;
    if (sameConfig && current.model === config?.model) return current.runtime;
    const platform = bindings.platform();
    if (!platform || !config) return current.runtime;
    const snapshot = snapshotRuntimeMessages(current.runtime);
    const epoch = bindings.bumpEpoch();
    const runtime = await bindings.create(config, platform, []);
    if (current.permissionMode) runtime.setPermissionMode(current.permissionMode);
    if (snapshot) reseedRuntimeFromSnapshot(runtime, snapshot);
    if (bindings.epoch() !== epoch || bindings.current() !== current) {
      runtime.abort();
      runtime.reset();
      const reason = bindings.invalidation();
      if (reason === 'delete' || bindings.current() !== current) {
        throw new RuntimeCreationInvalidatedError(reason);
      }
      continue;
    }
    bindings.install({
      sessionId,
      runtime,
      configKey,
      configRevision: revision,
      model: config.model,
      modelKey: current.modelKey,
      sessionScoped: false,
      reasoningEffort: config.reasoningEffort,
      permissionMode: runtime.getPermissionMode?.(),
    });
    bindings.clearInvalidation();
    current.runtime.reset();
    return runtime;
  }
}
