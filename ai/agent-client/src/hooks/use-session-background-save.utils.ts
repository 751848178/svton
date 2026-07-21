import type { DisplayMessage } from '../service/chat.service';

export function prepareBackgroundMessagesForSave(messages: DisplayMessage[] | undefined): DisplayMessage[] {
  if (!messages?.length) return [];
  return messages
    .filter((message) => message.role !== 'system')
    .map((message) => ({ ...message, isStreaming: false }));
}
