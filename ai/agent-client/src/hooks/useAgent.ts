import { useEffect, useState } from 'react';
import { useAgentContext } from '../service/provider';

export function useAgent() {
  const { platform, chatService, sessionService, chatInternal } = useAgentContext();
  const [status, setStatus] = useState(() => chatInternal.getState('status'));
  const [, setPendingApprovalVersion] = useState(
    () => chatInternal.getState('pendingApprovalVersion'),
  );

  useEffect(() => {
    const unsubStatus = chatInternal.subscribe('status', () => {
      setStatus(chatInternal.getState('status'));
    });
    const unsubPending = chatInternal.subscribe('pendingApprovalVersion', () => {
      setPendingApprovalVersion(chatInternal.getState('pendingApprovalVersion'));
    });
    return () => {
      unsubStatus();
      unsubPending();
    };
  }, [chatInternal]);

  return {
    platform,
    chatService,
    sessionService,
    isConnected: status !== 'idle' || chatService.hasPendingApprovals,
  };
}
