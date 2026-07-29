import type { AgentRuntime } from '@svton/agent-core';
import type { DisplayMessage } from '../types';
import { chatToDisplayMessages } from './chat-to-display.utils';
import { restoreMessagesIntoRuntime } from './chat-runtime-bridge';
import { attachRuntimeMessageIndexes } from './chat-runtime-history.service';

/** Serializes display-to-runtime restores and rejects stale session ownership. */
export class ChatSessionRuntimeService {
  private generation = 0;

  invalidate(): void {
    this.generation += 1;
  }

  async restore(
    runtime: AgentRuntime | null,
    sessionId: string | null,
    messages: DisplayMessage[],
    isCurrent: () => boolean,
  ): Promise<DisplayMessage[] | null> {
    if (!runtime) return null;
    const generation = ++this.generation;
    const restored = await restoreMessagesIntoRuntime(
      runtime,
      sessionId,
      messages,
      () => generation === this.generation && isCurrent(),
    );
    if (!restored) return null;
    return attachRuntimeMessageIndexes(
      chatToDisplayMessages(runtime.getMessages()),
      runtime,
    );
  }
}
