import type { AgentConfig, PermissionMode } from '@svton/agent-core';
import type { IPlatform } from '@svton/agent-platform';
import type { ModelKey } from '../model-switch/model-switch.types';
import type { ChatRuntimeSlot, PreparedRuntimeSwitch } from './chat-runtime-registry.types';

export interface RuntimeConfigurationSnapshot {
  platform: IPlatform;
  config: AgentConfig;
  configKey?: string;
  revision: number;
}

export interface RuntimeDefaultSnapshot extends RuntimeConfigurationSnapshot {
  modelKey: ModelKey | null;
}

/** Keeps reconfiguration inputs separate from the persisted future-session default. */
export class ChatRuntimeConfigurationService {
  private current: RuntimeConfigurationSnapshot | null = null;
  private creation: RuntimeDefaultSnapshot | null = null;

  configure(
    platform: IPlatform,
    config: AgentConfig,
    configKey?: string,
    modelKey: ModelKey | null = null,
  ): boolean {
    const changed = this.current?.platform !== platform
      || this.current.config !== config
      || this.current.configKey !== configKey;
    const revision = changed ? (this.current?.revision ?? 0) + 1 : this.current?.revision ?? 0;
    this.current = { platform, config, configKey, revision };
    this.creation = { platform, config, configKey, revision, modelKey };
    return changed;
  }

  currentSnapshot(): RuntimeConfigurationSnapshot | null { return this.current; }

  creationSnapshot(): RuntimeDefaultSnapshot | null { return this.creation; }

  commitPreparedDefault(candidate: PreparedRuntimeSwitch): void {
    this.commitDefault({
      platform: candidate.platform,
      config: candidate.config,
      configKey: candidate.configKey,
      revision: this.nextCreationRevision(),
      modelKey: candidate.modelKey,
    });
  }

  captureSlotDefault(slot: ChatRuntimeSlot | null, key: ModelKey): RuntimeDefaultSnapshot | null {
    if (
      !slot?.config
      || !slot.platform
      || slot.modelKey?.providerId !== key.providerId
      || slot.modelKey.modelId !== key.modelId
    ) return null;
    return {
      platform: slot.platform,
      config: slot.config,
      configKey: slot.configKey,
      revision: this.nextCreationRevision(),
      modelKey: Object.freeze({ ...key }),
    };
  }

  commitDefault(snapshot: RuntimeDefaultSnapshot): void {
    this.creation = snapshot;
  }

  commitPermissionDefault(mode: PermissionMode): boolean {
    const manager = this.creation?.config.capabilities?.permissionManager;
    if (!manager) return false;
    manager.setMode(mode);
    return true;
  }

  private nextCreationRevision(): number {
    return (this.creation?.revision ?? 0) + 1;
  }
}
