import type {
  PermissionMode,
  ReasoningEffort,
  SvtonAgentRuntime,
} from '@svton/agent-core';
import type { Usage } from '@earendil-works/pi-ai';
import type { ChatStatus, PlanProgress } from '../types';
import type { ModelKey } from '../model-switch/model-switch.types';
import type { ChatRunCoordinatorService } from './chat-run-coordinator.service';
import type { ChatRuntimeRegistryService } from './chat-runtime-registry.service';
import type { ChatSessionProjectionService } from './chat-session-projection.service';

export interface SelectedRuntimeProjection {
  status: ChatStatus;
  lastUsage: Usage | null;
  activePlan: PlanProgress | null;
  runtime: SvtonAgentRuntime | null;
  runtimeSessionId: string | null;
  currentModel: string;
  currentModelKey: ModelKey | null;
  currentReasoningEffort: ReasoningEffort | undefined;
  currentPermissionMode: PermissionMode | undefined;
}

export function projectSelectedRuntime(
  owner: string | null,
  runtimes: ChatRuntimeRegistryService,
  projections: ChatSessionProjectionService,
  runs: ChatRunCoordinatorService,
): SelectedRuntimeProjection {
  const selected = projections.selected(owner);
  const slot = runtimes.slot(owner);
  const defaultKey = runtimes.creationModelKey();
  return {
    status: runs.status(owner),
    lastUsage: selected.usage,
    activePlan: selected.plan,
    runtime: slot?.runtime ?? null,
    runtimeSessionId: slot ? owner : null,
    currentModel: slot?.model ?? runtimes.creationModel(),
    currentModelKey: slot?.modelKey
      ?? (slot && defaultKey?.modelId === slot.model ? defaultKey : null),
    currentReasoningEffort: slot?.reasoningEffort
      ?? (!slot ? runtimes.creationReasoningEffort() : undefined),
    currentPermissionMode: slot?.permissionMode
      ?? (!slot ? runtimes.creationPermissionMode() : undefined),
  };
}
