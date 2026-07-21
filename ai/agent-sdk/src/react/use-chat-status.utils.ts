import type { ChatStatus } from './types';

export function isActiveChatStatus(status: ChatStatus): boolean {
  return status === 'running' || status === 'waiting_approval';
}
