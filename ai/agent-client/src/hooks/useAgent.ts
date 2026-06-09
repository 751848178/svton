import { useAgentContext } from '../service/provider';

/**
 * Main Agent hook.
 * Returns the ChatService and SessionService instances.
 */
export function useAgent() {
  const { platform, chatService, sessionService } = useAgentContext();

  return {
    platform,
    chatService,
    sessionService,
    isConnected: chatService.status !== 'idle' || chatService.hasPendingApprovals,
  };
}
