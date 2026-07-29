import type { AgentConfig, SvtonAgentRuntime } from '@svton/agent-core';
import type { IPlatform } from '@svton/agent-platform';
import type { DisplayMessage } from '../types';
import { piMessagesToDisplay } from './pi-message-display-boundary.utils';
import { restoreMessagesIntoRuntime } from './chat-runtime-bridge';
import { attachRuntimeMessageIndexes } from './chat-runtime-history.service';
import { createIsolatedRuntime } from './chat-runtime-lifecycle';

export interface RuntimeClearContext {
  activeSessionId: string | null;
  backgroundSessionId: string | null;
  runtimeSessionId: string | null;
  config: AgentConfig | null;
  platform: IPlatform | null;
}

/** Serializes display-to-runtime restores and rejects stale session ownership. */
export class ChatSessionRuntimeService {
  private generation = 0;
  private backgroundRuntime: SvtonAgentRuntime | null = null;

  invalidate(): void {
    this.generation += 1;
  }

  async clear(
    runtime: SvtonAgentRuntime | null,
    context: RuntimeClearContext,
  ): Promise<SvtonAgentRuntime | null> {
    this.invalidate();
    if (
      runtime
      && context.backgroundSessionId
      && context.runtimeSessionId === context.backgroundSessionId
    ) {
      if (!context.config || !context.platform) {
        throw new Error('Cannot isolate an active background runtime before initialization');
      }
      this.backgroundRuntime = runtime;
      return createIsolatedRuntime(context.config, context.platform);
    }
    runtime?.reset();
    return runtime;
  }

  getStreamingRuntime(
    activeRuntime: SvtonAgentRuntime | null,
    backgroundSessionId: string | null,
  ): SvtonAgentRuntime | null {
    return backgroundSessionId ? this.backgroundRuntime ?? activeRuntime : activeRuntime;
  }

  releaseBackgroundRuntime(): void {
    this.backgroundRuntime = null;
  }

  async restore(
    runtime: SvtonAgentRuntime | null,
    sessionId: string | null,
    _messages: DisplayMessage[],
    isCurrent: () => boolean,
  ): Promise<DisplayMessage[] | null> {
    if (!runtime) return null;
    const generation = ++this.generation;
    const restored = await restoreMessagesIntoRuntime(
      runtime,
      sessionId,
      () => generation === this.generation && isCurrent(),
    );
    if (restored === 'stale') return null;
    if (restored === 'empty') return [];
    return attachRuntimeMessageIndexes(
      piMessagesToDisplay(runtime.getMessages()),
      runtime,
    );
  }
}
