import type { AgentRuntime } from '@svton/agent-core';
import type { DisplayMessage } from '../types';
import { finalizeStalePendingApprovals } from './chat-message-tool-status.utils';
import { chatToDisplayMessages } from './chat-to-display.utils';
import { restoreMessagesIntoRuntime } from './chat-runtime-bridge';
import { attachRuntimeMessageIndexes } from './chat-runtime-history.service';

interface MessageLoaderDeps {
  runtime: AgentRuntime | null;
  sessionId: string | null;
  apply: (messages: DisplayMessage[]) => void;
  recordHistory: (messages: DisplayMessage[]) => void;
}

export interface LoadMessagesOptions {
  preservePendingToolCalls?: boolean;
}

export function loadChatMessages(
  deps: MessageLoaderDeps,
  messages: DisplayMessage[],
  options?: LoadMessagesOptions,
): void {
  const loaded = options?.preservePendingToolCalls
    ? messages
    : finalizeStalePendingApprovals(messages);
  deps.apply(loaded);
  deps.recordHistory(loaded);
  if (!deps.runtime) return;
  const runtime = deps.runtime;
  void restoreMessagesIntoRuntime(runtime, deps.sessionId, loaded).then((restored) => {
    if (!restored || !deps.sessionId) return;
    const refreshed = chatToDisplayMessages(runtime.getMessages());
    if (refreshed.length > 0) {
      deps.apply(attachRuntimeMessageIndexes(refreshed, runtime));
    }
  });
}
