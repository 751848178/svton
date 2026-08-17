import type { ReasoningEffort, SvtonAgentRuntime } from '@svton/agent-core';
import type { ModelKey } from '../model-switch/model-switch.types';
import { RuntimeCreationInvalidatedError, type ChatRuntimeSlot } from './chat-runtime-registry.types';

interface RuntimeInstallationBindings {
  current: () => ChatRuntimeSlot | undefined;
  epoch: () => number;
  invalidation: () => 'refresh' | 'delete';
  install: (slot: ChatRuntimeSlot) => void;
  clearInvalidation: () => void;
}

interface RegisteredRuntimeInstallation {
  sessionId: string | null;
  runtime: SvtonAgentRuntime;
  expectedEpoch: number;
  model: string;
  reasoningEffort: ReasoningEffort | undefined;
  modelKey: ModelKey | null;
  configKey: string | undefined;
  configRevision: number;
  slots: Map<string | null, ChatRuntimeSlot>;
  epochs: ReadonlyMap<string | null, number>;
  invalidations: Map<string | null, 'refresh' | 'delete'>;
}

export function installCreatedRuntime(
  sessionId: string | null,
  runtime: SvtonAgentRuntime,
  expectedEpoch: number,
  model: string,
  reasoningEffort: ReasoningEffort | undefined,
  modelKey: ModelKey | null,
  configKey: string | undefined,
  configRevision: number,
  bindings: RuntimeInstallationBindings,
): SvtonAgentRuntime {
  const existing = bindings.current();
  if (bindings.epoch() !== expectedEpoch || existing) {
    runtime.abort();
    runtime.reset();
    if (existing) return existing.runtime;
    throw new RuntimeCreationInvalidatedError(bindings.invalidation());
  }
  bindings.install({
    sessionId,
    runtime,
    configKey,
    configRevision,
    model,
    modelKey,
    reasoningEffort,
    permissionMode: runtime.getPermissionMode?.(),
    sessionScoped: false,
  });
  bindings.clearInvalidation();
  return runtime;
}

export function installRegisteredRuntime(input: RegisteredRuntimeInstallation): SvtonAgentRuntime {
  const { sessionId } = input;
  return installCreatedRuntime(
    sessionId, input.runtime, input.expectedEpoch, input.model, input.reasoningEffort,
    input.modelKey, input.configKey, input.configRevision,
    {
      current: () => input.slots.get(sessionId),
      epoch: () => input.epochs.get(sessionId) ?? 0,
      invalidation: () => input.invalidations.get(sessionId) ?? 'delete',
      install: (slot) => input.slots.set(sessionId, slot),
      clearInvalidation: () => input.invalidations.delete(sessionId),
    },
  );
}
