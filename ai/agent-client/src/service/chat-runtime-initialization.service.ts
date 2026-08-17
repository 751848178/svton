import type { AgentConfig } from '@svton/agent-core';
import type { IPlatform } from '@svton/agent-platform';
import type { InputHistoryStore } from './chat-input-history';
import type { ChatRunOwnershipService } from './chat-run-ownership.service';
import type { ChatRuntimeRegistryService } from './chat-runtime-registry.service';
import type { ModelKey } from '../model-switch/model-switch.types';

interface RuntimeInitializationBindings {
  runtimes: ChatRuntimeRegistryService;
  ownership: ChatRunOwnershipService;
  history: InputHistoryStore;
  owner: () => string | null;
  inputHistory: () => string[];
  publishInputHistory: (items: string[]) => void;
  interruptOwner: (sessionId: string | null) => void;
  publishSelected: () => void;
}

/** Applies default config without replacing a runtime that is currently active. */
export class ChatRuntimeInitializationService {
  ready = false;
  private generation = 0;

  constructor(private readonly bindings: RuntimeInitializationBindings) {}

  async init(
    platform: IPlatform,
    config: AgentConfig,
    runtimeKey?: string,
    modelKey: ModelKey | null = null,
  ): Promise<void> {
    const generation = ++this.generation;
    this.ready = false;
    this.bindings.runtimes.configure(platform, config, runtimeKey, modelKey);
    await this.bindings.history.attach({
      platform,
      get: this.bindings.inputHistory,
      publish: this.bindings.publishInputHistory,
    });
    if (!this.isCurrent(generation)) return;
    const owner = this.bindings.owner();
    const slot = this.bindings.runtimes.slot(owner);
    if (!slot || !this.bindings.ownership.isProcessing(owner)) {
      const runtime = await this.bindings.runtimes.ensureCurrent(owner);
      if (!this.isCurrent(generation)) return;
      if (slot && runtime !== slot.runtime) this.bindings.interruptOwner(owner);
    }
    if (!this.isCurrent(generation)) return;
    this.ready = true;
    this.bindings.publishSelected();
  }

  private isCurrent(generation: number): boolean {
    return generation === this.generation;
  }
}
