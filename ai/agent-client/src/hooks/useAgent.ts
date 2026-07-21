import { useEffect, useState } from 'react';
import { useAgentContext } from '../service/provider';
import { hasVisiblePendingToolCalls } from './use-tool-approval.utils';

export function useAgent() {
  const { platform, chatService, sessionService, chatInternal } = useAgentContext();
  const [status, setStatus] = useState(() => chatInternal.getState('status'));
  const [messages, setMessages] = useState(() => chatInternal.getState('messages'));
  const [, setPendingApprovalVersion] = useState(
    () => chatInternal.getState('pendingApprovalVersion'),
  );

  useEffect(() => {
    const unsubStatus = chatInternal.subscribe('status', () => {
      setStatus(chatInternal.getState('status'));
    });
    const unsubMessages = chatInternal.subscribe('messages', () => {
      setMessages(chatInternal.getState('messages'));
    });
    const unsubPending = chatInternal.subscribe('pendingApprovalVersion', () => {
      setPendingApprovalVersion(chatInternal.getState('pendingApprovalVersion'));
    });
    return () => {
      unsubStatus();
      unsubMessages();
      unsubPending();
    };
  }, [chatInternal]);

  const hasPending = chatService.hasPendingApprovals || hasVisiblePendingToolCalls(messages);

  return {
    platform,
    chatService,
    sessionService,
    isConnected: status !== 'idle' || hasPending,
  };
}
