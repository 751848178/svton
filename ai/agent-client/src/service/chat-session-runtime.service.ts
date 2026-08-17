import type { SvtonAgentRuntime } from '@svton/agent-core';
import type { DisplayMessage } from '../types';
import { piMessagesToDisplay } from './pi-message-display-boundary.utils';
import { restoreMessagesIntoRuntime } from './chat-runtime-bridge';
import { attachRuntimeMessageIndexes } from './chat-runtime-history.service';
import { mergePersistedTimeline } from './timeline-restore-merge';
import { appendInterruptedApprovalArchive } from './timeline-restore-approval-archive';
import type { ChatRunRecovery } from './chat-run-journal.types';
import { reconcileInterruptedDisplay } from './chat-interrupted-display-recovery';

/** Restores checkpoint-owned Pi state, projects it to display, and rejects stale ownership. */
export class ChatSessionRuntimeService {
  private readonly generations = new Map<string | null, number>();

  invalidate(sessionId: string | null): void {
    this.generations.set(sessionId, (this.generations.get(sessionId) ?? 0) + 1);
  }

  async restore(
    runtime: SvtonAgentRuntime | null,
    sessionId: string | null,
    messages: DisplayMessage[],
    isCurrent: () => boolean,
    recovery?: ChatRunRecovery,
  ): Promise<DisplayMessage[] | null> {
    if (!runtime) return null;
    const generation = (this.generations.get(sessionId) ?? 0) + 1;
    this.generations.set(sessionId, generation);
    const restored = await restoreMessagesIntoRuntime(
      runtime,
      sessionId,
      () => generation === this.generations.get(sessionId) && isCurrent(),
    );
    if (restored.kind === 'stale') return null;
    if (restored.kind === 'empty') {
      const base = appendInterruptedApprovalArchive([], messages);
      return recovery?.recoveredAsInterrupted && recovery.state
        ? reconcileInterruptedDisplay(base, messages, recovery.state)
        : base;
    }
    const canonicalDisplay = attachRuntimeMessageIndexes(
      mergePersistedTimeline(piMessagesToDisplay(runtime.getMessages()), messages),
      runtime,
    );
    const restoredDisplay = appendInterruptedApprovalArchive(canonicalDisplay, messages);
    return recovery?.recoveredAsInterrupted && recovery.state
      ? reconcileInterruptedDisplay(restoredDisplay, messages, recovery.state)
      : restoredDisplay;
  }
}
