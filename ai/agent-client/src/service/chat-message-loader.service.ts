import type { DisplayMessage } from '../types';
import { finalizeStalePendingApprovals } from './chat-message-tool-status.utils';

export interface LoadMessagesOptions {
  preservePendingToolCalls?: boolean;
  preserveLiveApprovals?: boolean;
}

export function prepareLoadedMessages(
  messages: DisplayMessage[],
  options?: LoadMessagesOptions,
): DisplayMessage[] {
  return options?.preservePendingToolCalls
    ? messages
    : finalizeStalePendingApprovals(messages);
}
