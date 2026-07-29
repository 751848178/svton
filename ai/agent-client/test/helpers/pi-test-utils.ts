/**
 * PI007 test utilities for the agent-client suite.
 *
 * PI002/PI003 deleted the `IProvider`/`StreamEvent` provider contract; the
 * runtime is now Pi-backed (`models.streamSimple`). These helpers let the
 * existing ChatService/hook tests drive a real `SvtonAgentRuntime` without a
 * network and without re-implementing the legacy queued-response pattern.
 *
 * Two layers:
 *  - {@link buildPiAgentConfig} — assembles a valid `AgentConfig` from a
 *    fauxProvider-backed `Models` collection (re-exported from agent-core's
 *    shared test helpers). Feed it to `ChatService.init`.
 *  - {@link EventScripter} — spies on `runtime.run` so tests can queue
 *    `AgentEvent[]` scripts (the same shape the old `MockProvider.addResponse`
 *    accepted, but using the live AgentEvent union). This keeps the streaming
 *    tests' intent while routing through the real ChatService.runAssistant.
 */

import { vi } from 'vitest';
import {
  ToolRegistry,
  type AgentConfig,
  type AgentEvent,
} from '@svton/agent-core';
import type { IPlatform, IStorage } from '@svton/agent-platform';
import {
  createMockModels,
  createMockPlatform,
  fauxAssistantMessage,
  fauxText,
  MemoryStorage,
  type MockModelsHandle,
} from '../../../agent-core/test/helpers';

export {
  createMockModels,
  createMockPlatform,
  fauxAssistantMessage,
  fauxText,
  MemoryStorage,
};
export type { MockModelsHandle };

/**
 * Build a Pi-backed `AgentConfig` identical in shape to what
 * `createAgentConfig` (agent-app) produces, but with a fauxProvider so no
 * network is touched. Tool registry and capabilities are optional overrides.
 */
export function buildPiAgentConfig(opts: {
  model?: string;
  toolRegistry?: ToolRegistry;
  capabilities?: AgentConfig['capabilities'];
  contextConfig?: AgentConfig['contextConfig'];
  workingDir?: string;
} = {}): { config: AgentConfig; mock: MockModelsHandle } {
  const modelId = opts.model ?? 'test-model';
  const mock = createMockModels(modelId);
  const config: AgentConfig = {
    models: mock.models,
    piModel: mock.model,
    model: modelId,
    toolRegistry: opts.toolRegistry ?? new ToolRegistry(),
    workingDir: opts.workingDir ?? '/',
    ...(opts.capabilities ? { capabilities: opts.capabilities } : {}),
    ...(opts.contextConfig ? { contextConfig: opts.contextConfig } : {}),
  };
  return { config, mock };
}

/**
 * Spy-based event scripter. Replace `runtime.run` with a generator that pops
 * queued `AgentEvent[]` scripts in order. Each call to `run` consumes one
 * queued response; if none remain it yields a terminal `done`.
 *
 * Usage:
 *   const scripter = new EventScripter(service);
 *   scripter.addResponse([{ type: 'text_delta', text: 'Hi' }, { type: 'done', stopReason: 'stop' }]);
 *   await service.sendMessage('Hello');
 */
export class EventScripter {
  private queue: AgentEvent[][] = [];
  readonly spy: ReturnType<typeof vi.spyOn>;

  constructor(service: { runtime: { run: (...args: any[]) => AsyncGenerator<AgentEvent> } }) {
    this.spy = vi.spyOn(service.runtime, 'run').mockImplementation(() => this.generator());
  }

  addResponse(events: AgentEvent[]): this {
    this.queue.push(events);
    return this;
  }

  setResponses(events: AgentEvent[][]): void {
    this.queue = [...events];
  }

  restore(): void {
    this.spy.mockRestore();
  }

  private async *generator(): AsyncGenerator<AgentEvent> {
    const response = this.queue.shift() ?? [{ type: 'done', stopReason: 'stop' }];
    for (const event of response) {
      yield event;
    }
  }
}

/** Build a browser-style IPlatform backed by MemoryStorage for agent-client tests. */
export function makeBrowserPlatform(storage?: IStorage): IPlatform {
  return createMockPlatform({
    storage: storage ?? new MemoryStorage(),
    type: 'browser',
    capabilities: {
      filesystem: false,
      process: false,
      watch: false,
      mcpStdio: false,
      clipboard: false,
      notification: false,
      sandboxing: false,
      pty: false,
      documentPreview: false,
      computerUse: false,
    },
  });
}
