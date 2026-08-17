import type { ReasoningEffort } from '@svton/agent-core';
import type { ModelSwitchHost } from '../model-switch/model-switch-host.types';
import type {
  ModelKey,
  ModelSwitchPhase,
  ModelSwitchRequest,
} from '../model-switch/model-switch.types';
import type { PermissionProfileHost } from '../permission-profile/permission-profile-host.types';
import type {
  PermissionProfilePhase,
  PermissionProfileRequest,
} from '../permission-profile/permission-profile.types';
import type { ApprovalQueue } from './chat-approval-queue';
import { ChatPermissionProfileService } from './chat-permission-profile.service';
import { createChatModelSwitchService } from './chat-model-switch.service';
import type { ChatRunCoordinatorService } from './chat-run-coordinator.service';
import type { ChatRunOwnershipService } from './chat-run-ownership.service';
import type { ChatRuntimeRegistryService } from './chat-runtime-registry.service';
import { ChatSessionSettingsLeaseService } from './chat-session-settings-lease.service';
import type { ChatUserInputStore } from './chat-user-input-store';

/** Coordinates model, permission, and reasoning mutations for addressed sessions. */
export class ChatRuntimeSettingsService {
  private readonly lease = new ChatSessionSettingsLeaseService();
  private readonly modelSwitch;
  private readonly permissionProfile;
  private reasoningRequestNumber = 0;

  constructor(
    runtimes: ChatRuntimeRegistryService,
    ownership: ChatRunOwnershipService,
    runs: ChatRunCoordinatorService,
    approvals: ApprovalQueue,
    userInputs: ChatUserInputStore,
    private readonly activeSession: () => string | null,
    publishSelected: () => void,
  ) {
    this.modelSwitch = createChatModelSwitchService(
      runtimes, ownership, runs, approvals, userInputs,
      activeSession, publishSelected, (sessionId) => this.lease.isPending(sessionId),
    );
    this.permissionProfile = new ChatPermissionProfileService({
      runtimes,
      lease: this.lease,
      activeSession,
      isProcessing: (sessionId) => ownership.isProcessing(sessionId),
      isStreaming: (sessionId) => runs.isStreaming(sessionId),
      hasApproval: (sessionId) => approvals.hasSession(sessionId),
      hasUserInput: (sessionId) => userInputs.head(sessionId) !== null,
      isModelSwitchPending: (sessionId) => this.modelSwitch.isPending(sessionId),
      publishSelected,
    });
  }

  switchModel(
    request: ModelSwitchRequest,
    host: ModelSwitchHost,
    publish: (phase: ModelSwitchPhase, request: ModelSwitchRequest) => void,
  ) {
    return this.modelSwitch.execute(request, host, publish);
  }

  retryModelDefaultPersistence(key: ModelKey, host: ModelSwitchHost): Promise<void> {
    return this.modelSwitch.retryActivePersistence(key, host);
  }

  getModelSwitchBlockedReason(): string | null {
    return this.modelSwitch.blockedReason(this.activeSession());
  }

  switchPermissionProfile(
    request: PermissionProfileRequest,
    host: PermissionProfileHost,
    publish: (phase: PermissionProfilePhase, request: PermissionProfileRequest) => void,
  ) {
    return this.permissionProfile.execute(request, host, publish);
  }

  setReasoningEffort(effort: ReasoningEffort | undefined) {
    return this.permissionProfile.changeReasoning(
      `reasoning-${++this.reasoningRequestNumber}`, this.activeSession(), effort,
    );
  }

  getPermissionProfileBlockedReason(): string | null {
    return this.permissionProfile.blockedReason(this.activeSession());
  }

  isPending(sessionId: string | null): boolean {
    return this.permissionProfile.isPending(sessionId);
  }
}
