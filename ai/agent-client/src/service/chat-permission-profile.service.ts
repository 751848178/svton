import type { PermissionMode, ReasoningEffort } from '@svton/agent-core';
import { toPublicModelSwitchError } from '../model-switch/model-switch-public-error';
import type { PermissionProfileHost } from '../permission-profile/permission-profile-host.types';
import type {
  PermissionProfilePhase,
  PermissionProfileRequest,
  PermissionProfileResult,
  ReasoningChangeResult,
} from '../permission-profile/permission-profile.types';
import type { ChatRuntimeRegistryService } from './chat-runtime-registry.service';
import { sessionMutationBlockedReason } from './chat-session-mutation-blocker';
import type { ChatSessionSettingsLeaseService } from './chat-session-settings-lease.service';

interface ChatPermissionBindings {
  runtimes: ChatRuntimeRegistryService;
  lease: ChatSessionSettingsLeaseService;
  activeSession: () => string | null;
  isProcessing: (sessionId: string | null) => boolean;
  isStreaming: (sessionId: string | null) => boolean;
  hasApproval: (sessionId: string | null) => boolean;
  hasUserInput: (sessionId: string | null) => boolean;
  isModelSwitchPending: (sessionId: string | null) => boolean;
  publishSelected: () => void;
}

export class ChatPermissionProfileService {
  private persistenceTail: Promise<void> = Promise.resolve();

  constructor(private readonly chat: ChatPermissionBindings) {}

  async execute(
    request: PermissionProfileRequest,
    host: PermissionProfileHost,
    publishPhase: (
      phase: PermissionProfilePhase,
      request: PermissionProfileRequest,
    ) => void,
  ): Promise<PermissionProfileResult> {
    if (!this.chat.lease.acquire(request.sessionId, request.requestId)) {
      return this.failed(request, host, 'blocked', '当前会话已有执行设置正在提交。', false);
    }
    let applied = false;
    try {
      const initialBlock = this.operationalBlock(request.sessionId);
      if (initialBlock) return this.failed(request, host, 'blocked', initialBlock, false);
      if (this.chat.runtimes.permissionMode(request.sessionId) !== request.from) {
        return this.failed(request, host, 'apply', '执行设置已变化，请根据当前值重试。', false);
      }
      if (this.chat.runtimes.creationPermissionMode() === undefined) {
        return this.failed(request, host, 'apply', '当前运行配置不支持执行设置。', false);
      }
      publishPhase('applying', request);
      const commitBlock = this.operationalBlock(request.sessionId);
      if (commitBlock) return this.failed(request, host, 'blocked', commitBlock, false);
      if (!this.chat.runtimes.setPermissionMode(request.sessionId, request.to)) {
        return this.failed(request, host, 'apply', '目标会话的执行设置未应用。', false);
      }
      applied = true;
      this.publishIfSelected(request.sessionId);
      publishPhase('persisting', request);
      await this.serializePersistence(async () => {
        const persistenceBlock = sessionMutationBlockedReason(this.chat, request.sessionId);
        if (persistenceBlock) throw new Error(persistenceBlock);
        await host.persistDefault(request.to);
        if (host.getPersisted() !== request.to) {
          throw new Error('执行配置未写入持久化存储。');
        }
      });
      if (!this.chat.runtimes.commitCreationPermissionDefault(request.to)) {
        throw new Error('未来会话的默认执行设置未更新。');
      }
      publishPhase('succeeded', request);
      return {
        kind: 'succeeded', requestId: request.requestId,
        active: request.to, persisted: host.getPersisted(),
      };
    } catch (error) {
      const rolledBack = applied
        && this.chat.runtimes.setPermissionMode(request.sessionId, request.from);
      this.publishIfSelected(request.sessionId);
      publishPhase('failed', request);
      return this.failed(
        request,
        host,
        'persistence',
        toPublicModelSwitchError(error),
        rolledBack,
      );
    } finally {
      this.chat.lease.release(request.sessionId, request.requestId);
    }
  }

  async changeReasoning(
    requestId: string,
    sessionId: string | null,
    effort: ReasoningEffort | undefined,
  ): Promise<ReasoningChangeResult> {
    if (!this.chat.lease.acquire(sessionId, requestId)) {
      return { kind: 'failed', code: 'blocked', message: '当前会话已有执行设置正在提交。' };
    }
    try {
      const block = this.operationalBlock(sessionId);
      if (block) return { kind: 'failed', code: 'blocked', message: block };
      if (!this.chat.runtimes.setReasoningEffort(sessionId, effort)) {
        return { kind: 'failed', code: 'apply', message: '目标会话的推理强度未应用。' };
      }
      this.publishIfSelected(sessionId);
      return { kind: 'succeeded' };
    } catch (error) {
      return { kind: 'failed', code: 'apply', message: toPublicModelSwitchError(error) };
    } finally {
      this.chat.lease.release(sessionId, requestId);
    }
  }

  blockedReason(sessionId: string | null): string | null {
    if (this.chat.lease.isPending(sessionId)) return '当前会话正在提交执行设置。';
    return this.operationalBlock(sessionId);
  }

  isPending(sessionId: string | null): boolean {
    return this.chat.lease.isPending(sessionId);
  }

  private operationalBlock(sessionId: string | null): string | null {
    if (this.chat.isModelSwitchPending(sessionId)) return '当前会话正在切换模型，请完成后再修改执行设置。';
    return sessionMutationBlockedReason(this.chat, sessionId);
  }

  private publishIfSelected(sessionId: string | null): void {
    if (sessionId === this.chat.activeSession()) this.chat.publishSelected();
  }

  private failed(
    request: PermissionProfileRequest,
    host: PermissionProfileHost,
    code: 'blocked' | 'apply' | 'persistence',
    message: string,
    rolledBack: boolean,
  ): PermissionProfileResult {
    const active = this.chat.runtimes.permissionMode(request.sessionId) ?? request.from;
    const persisted = host.getPersisted();
    return {
      kind: 'failed', requestId: request.requestId, active, persisted,
      code, message, rolledBack, activeDefaultSplit: active !== persisted,
    };
  }

  private serializePersistence<T>(operation: () => Promise<T>): Promise<T> {
    const task = this.persistenceTail.then(operation, operation);
    this.persistenceTail = task.then(() => undefined, () => undefined);
    return task;
  }
}
