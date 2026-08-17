import type { AgentConfig, PermissionMode, SvtonAgentRuntime } from '@svton/agent-core';
import type { IPlatform } from '@svton/agent-platform';
import type { ModelKey } from '../model-switch/model-switch.types';
import { createConfiguredRuntime } from './chat-runtime-lifecycle';
import {
  ChatRuntimeConfigurationService,
  type RuntimeDefaultSnapshot,
} from './chat-runtime-configuration.service';
import { RuntimeCreationInvalidatedError, type ChatRuntimeSlot, type PreparedRuntimeSwitch } from './chat-runtime-registry.types';
import { commitRuntimeSwitch, completeRuntimeSwitchCommit, disposeRuntimeSwitch, prepareRuntimeSwitch } from './chat-runtime-switch.service';
import { installRegisteredRuntime } from './chat-runtime-slot-installation';
import { setRuntimeSlotReasoning } from './chat-runtime-slot-reasoning';
import { setRuntimeSlotPermission } from './chat-runtime-slot-permission';
import { replaceRuntimeSlot } from './chat-runtime-slot-replacement';
import {
  abortRegisteredRuntime,
  cancelRegisteredRuntimeCreation,
  deleteRegisteredRuntime,
} from './chat-runtime-registry-cleanup';

export type { ChatRuntimeSlot, PreparedRuntimeSwitch } from './chat-runtime-registry.types';

/** Owns independently configured runtime instances addressed by session id. */
export class ChatRuntimeRegistryService {
  private readonly slots = new Map<string | null, ChatRuntimeSlot>();
  private readonly creating = new Map<string | null, Promise<SvtonAgentRuntime>>();
  private readonly reconfiguring = new Map<string | null, Promise<SvtonAgentRuntime>>();
  private readonly epochs = new Map<string | null, number>();
  private readonly invalidations = new Map<string | null, 'refresh' | 'delete'>();
  private readonly configuration = new ChatRuntimeConfigurationService();

  constructor(private readonly createRuntime: typeof createConfiguredRuntime = createConfiguredRuntime) {}

  configure(platform: IPlatform, config: AgentConfig, configKey?: string,
    modelKey: ModelKey | null = null): void {
    const changed = this.configuration.configure(platform, config, configKey, modelKey);
    if (changed) {
      const pending = new Set([...this.creating.keys(), ...this.reconfiguring.keys()]);
      for (const sessionId of pending) {
        this.invalidations.set(sessionId, 'refresh');
        this.bumpEpoch(sessionId);
      }
    }
  }

  get(sessionId: string | null): SvtonAgentRuntime | null { return this.slots.get(sessionId)?.runtime ?? null; }

  slot(sessionId: string | null): ChatRuntimeSlot | null { return this.slots.get(sessionId) ?? null; }

  creationModelKey(): ModelKey | null { return this.configuration.creationSnapshot()?.modelKey ?? null; }

  creationModel(): string { return this.configuration.creationSnapshot()?.config.model ?? ''; }

  creationReasoningEffort(): AgentConfig['reasoningEffort'] { return this.configuration.creationSnapshot()?.config.reasoningEffort; }

  creationPermissionMode(): PermissionMode | undefined {
    return this.configuration.creationSnapshot()?.config.capabilities?.permissionManager?.getMode();
  }

  setReasoningEffort(sessionId: string | null, effort: AgentConfig['reasoningEffort']): boolean {
    return setRuntimeSlotReasoning(this.slots, sessionId, effort);
  }

  permissionMode(sessionId: string | null): PermissionMode | undefined {
    const slot = this.slots.get(sessionId);
    if (!slot) return this.creationPermissionMode();
    return slot.runtime.getPermissionMode?.() ?? slot.permissionMode;
  }

  setPermissionMode(sessionId: string | null, mode: PermissionMode): boolean {
    return setRuntimeSlotPermission(this.slots, sessionId, mode);
  }

  commitCreationPermissionDefault(mode: PermissionMode): boolean {
    return this.configuration.commitPermissionDefault(mode);
  }

  has(sessionId: string | null): boolean { return this.slots.has(sessionId); }

  async ensure(sessionId: string | null): Promise<SvtonAgentRuntime> {
    const existing = this.get(sessionId);
    if (existing) return existing;
    const pending = this.creating.get(sessionId);
    if (pending) return pending;
    this.invalidations.delete(sessionId);
    const defaults = this.configuration.creationSnapshot();
    if (!defaults) throw new Error('Chat runtime registry is not initialized');
    const { platform, config, configKey, revision: configRevision, modelKey } = defaults;
    const epoch = this.epochs.get(sessionId) ?? 0;
    let creation!: Promise<SvtonAgentRuntime>;
    creation = this.createRuntime(config, platform, [])
      .then((runtime) => installRegisteredRuntime({
        sessionId, runtime, expectedEpoch: epoch, model: config.model,
        reasoningEffort: config.reasoningEffort, modelKey, configKey, configRevision,
        slots: this.slots, epochs: this.epochs, invalidations: this.invalidations,
      }))
      .finally(() => {
        if (this.creating.get(sessionId) === creation) this.creating.delete(sessionId);
      })
      .catch((error) => {
        if (error instanceof RuntimeCreationInvalidatedError && error.reason === 'refresh') {
          return this.ensure(sessionId);
        }
        throw error;
      });
    this.creating.set(sessionId, creation);
    return creation;
  }

  async ensureCurrent(sessionId: string | null): Promise<SvtonAgentRuntime> { return this.has(sessionId) ? this.reconfigure(sessionId) : this.ensure(sessionId); }

  async reconfigure(sessionId: string | null): Promise<SvtonAgentRuntime> {
    const pending = this.reconfiguring.get(sessionId);
    if (pending) return pending;
    let task!: Promise<SvtonAgentRuntime>;
    task = this.replace(sessionId).finally(() => {
      if (this.reconfiguring.get(sessionId) === task) this.reconfiguring.delete(sessionId);
    });
    this.reconfiguring.set(sessionId, task);
    return task;
  }

  private async replace(sessionId: string | null): Promise<SvtonAgentRuntime> {
    return replaceRuntimeSlot(sessionId, {
      current: () => this.slots.get(sessionId),
      config: () => this.configuration.currentSnapshot()?.config ?? null,
      platform: () => this.configuration.currentSnapshot()?.platform ?? null,
      configKey: () => this.configuration.currentSnapshot()?.configKey,
      configRevision: () => this.configuration.currentSnapshot()?.revision ?? 0,
      epoch: () => this.epochs.get(sessionId) ?? 0,
      bumpEpoch: () => this.bumpEpoch(sessionId),
      invalidation: () => this.invalidations.get(sessionId) ?? 'delete',
      create: this.createRuntime,
      install: (slot) => this.slots.set(sessionId, slot),
      clearInvalidation: () => this.invalidations.delete(sessionId),
    });
  }

  prepareSwitch(sessionId: string | null, platform: IPlatform, config: AgentConfig,
    modelKey: ModelKey, configKey?: string): Promise<PreparedRuntimeSwitch> {
    return prepareRuntimeSwitch(
      this.createRuntime, sessionId, this.slots.get(sessionId) ?? null,
      platform, config, modelKey, configKey,
    );
  }

  commitSwitch(candidate: PreparedRuntimeSwitch): boolean {
    const current = this.slots.get(candidate.sessionId) ?? null;
    const revision = current?.configRevision ?? this.configuration.creationSnapshot()?.revision ?? 0;
    const slot = commitRuntimeSwitch(candidate, current, revision);
    if (!slot) return false;
    this.slots.set(candidate.sessionId, slot);
    completeRuntimeSwitchCommit(candidate);
    return true;
  }

  commitCreationDefault(candidate: PreparedRuntimeSwitch): void { this.configuration.commitPreparedDefault(candidate); }

  captureSessionDefault(sessionId: string | null, key: ModelKey): RuntimeDefaultSnapshot | null {
    return this.configuration.captureSlotDefault(this.slots.get(sessionId) ?? null, key);
  }

  commitCapturedDefault(snapshot: RuntimeDefaultSnapshot): void { this.configuration.commitDefault(snapshot); }

  disposeSwitch(candidate: PreparedRuntimeSwitch): void { disposeRuntimeSwitch(candidate); }

  abort(sessionId: string | null): boolean {
    return abortRegisteredRuntime(this.slots, sessionId);
  }

  cancelPending(sessionId: string | null): boolean {
    return cancelRegisteredRuntimeCreation(
      sessionId, this.creating, this.reconfiguring, this.invalidations,
      () => { this.bumpEpoch(sessionId); },
    );
  }

  delete(sessionId: string | null): boolean {
    return deleteRegisteredRuntime(
      sessionId, this.slots, this.creating, this.reconfiguring,
      this.invalidations, () => { this.bumpEpoch(sessionId); },
    );
  }

  sessionIds(): Array<string | null> { return [...this.slots.keys()]; }

  private bumpEpoch(sessionId: string | null): number {
    const next = (this.epochs.get(sessionId) ?? 0) + 1;
    this.epochs.set(sessionId, next);
    return next;
  }
}
