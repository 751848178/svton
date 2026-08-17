import type {
  ModelKey,
  ModelSwitchPhase,
  ModelSwitchRequest,
  ModelSwitchResult,
} from '../model-switch/model-switch.types';
import type { ModelSwitchHost } from '../model-switch/model-switch-host.types';
import {
  ModelSwitchTransactionService,
  type ModelSwitchBindings,
} from '../model-switch/model-switch-transaction.service';
import type { ChatRuntimeRegistryService } from './chat-runtime-registry.service';
import type { PreparedRuntimeSwitch } from './chat-runtime-registry.types';
import type { ChatRunOwnershipService } from './chat-run-ownership.service';
import type { ChatRunCoordinatorService } from './chat-run-coordinator.service';
import type { ApprovalQueue } from './chat-approval-queue';
import type { ChatUserInputStore } from './chat-user-input-store';
import type { ReasoningEffort } from '@svton/agent-core';
import { sessionMutationBlockedReason } from './chat-session-mutation-blocker';

interface ChatModelSwitchBindings {
  runtimes: ChatRuntimeRegistryService;
  activeSession: () => string | null;
  isProcessing: (sessionId: string | null) => boolean;
  isStreaming: (sessionId: string | null) => boolean;
  hasApproval: (sessionId: string | null) => boolean;
  hasUserInput: (sessionId: string | null) => boolean;
  publishSelected: () => void;
  isSettingsMutationPending: (sessionId: string | null) => boolean;
}

/** Owns one session-addressed switch transaction without touching peer slots. */
export class ChatModelSwitchService {
  private readonly transaction = new ModelSwitchTransactionService();
  private readonly pending = new Map<string | null, string>();

  constructor(private readonly chat: ChatModelSwitchBindings) {}

  async execute(
    request: ModelSwitchRequest,
    host: ModelSwitchHost,
    publishPhase: (phase: ModelSwitchPhase, request: ModelSwitchRequest) => void,
  ): Promise<ModelSwitchResult> {
    this.pending.set(request.sessionId, request.requestId);
    const bindings: ModelSwitchBindings<PreparedRuntimeSwitch> = {
      active: (sessionId) => this.chat.runtimes.slot(sessionId)?.modelKey ?? request.from,
      persisted: host.getPersisted,
      blockedReason: (sessionId) => this.blockedReason(sessionId),
      prepare: async (next) => {
        const prepared = await host.prepareConfig(next);
        return this.chat.runtimes.prepareSwitch(
          next.sessionId, prepared.platform, prepared.config, next.to, prepared.runtimeKey,
        );
      },
      commit: (next, candidate) => {
        if (!this.chat.runtimes.commitSwitch(candidate)) return false;
        if (next.sessionId === this.chat.activeSession()) {
          this.chat.publishSelected();
        }
        return true;
      },
      dispose: (candidate) => this.chat.runtimes.disposeSwitch(candidate),
      persistDefault: (next, candidate) => host.persistDefault(next.to, {
        config: candidate.config,
        platform: candidate.platform,
        runtimeKey: candidate.configKey,
      }),
      commitPersistedDefault: (_request, candidate) =>
        this.chat.runtimes.commitCreationDefault(candidate),
      publishPhase,
    };
    try {
      return await this.transaction.execute(request, bindings);
    } finally {
      if (this.pending.get(request.sessionId) === request.requestId) {
        this.pending.delete(request.sessionId);
      }
    }
  }

  async retryPersistence(
    sessionId: string | null,
    key: ModelKey,
    host: ModelSwitchHost,
  ): Promise<void> {
    const snapshot = this.chat.runtimes.captureSessionDefault(sessionId, key);
    if (!snapshot) {
      throw new Error('当前会话的已提交模型配置不可用于更新默认模型。');
    }
    await host.persistDefault(key, {
      config: snapshot.config,
      platform: snapshot.platform,
      runtimeKey: snapshot.configKey,
    });
    this.chat.runtimes.commitCapturedDefault(snapshot);
  }

  blockedReason(sessionId: string | null): string | null {
    if (this.chat.isSettingsMutationPending(sessionId)) {
      return '当前会话正在提交执行设置，请完成后再切换模型。';
    }
    return sessionMutationBlockedReason(this.chat, sessionId, '切换模型');
  }

  isPending(sessionId: string | null): boolean { return this.pending.has(sessionId); }

  blockedActiveReason(): string | null {
    return this.blockedReason(this.chat.activeSession());
  }

  retryActivePersistence(key: ModelKey, host: ModelSwitchHost): Promise<void> {
    return this.retryPersistence(this.chat.activeSession(), key, host);
  }

  setActiveReasoningEffort(effort: ReasoningEffort | undefined): void {
    this.chat.runtimes.setReasoningEffort(this.chat.activeSession(), effort);
    this.chat.publishSelected();
  }
}

export function createChatModelSwitchService(
  runtimes: ChatRuntimeRegistryService,
  ownership: ChatRunOwnershipService,
  runs: ChatRunCoordinatorService,
  approvals: ApprovalQueue,
  userInputs: ChatUserInputStore,
  activeSession: () => string | null,
  publishSelected: () => void,
  isSettingsMutationPending: (sessionId: string | null) => boolean = () => false,
): ChatModelSwitchService {
  return new ChatModelSwitchService({
    runtimes, activeSession, publishSelected, isSettingsMutationPending,
    isProcessing: (sessionId) => ownership.isProcessing(sessionId),
    isStreaming: (sessionId) => runs.isStreaming(sessionId),
    hasApproval: (sessionId) => approvals.hasSession(sessionId),
    hasUserInput: (sessionId) => userInputs.head(sessionId) !== null,
  });
}
