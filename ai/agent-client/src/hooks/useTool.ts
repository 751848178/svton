import { useState, useEffect, useMemo } from 'react';
import { useAgentContext } from '../service/provider';
import type { DisplayToolCall } from '../service/chat.service';

/**
 * Tool approval hook.
 * Subscribes to messages observable to reactively derive pending tool calls.
 */
export function useToolApproval() {
  const { chatService, chatInternal } = useAgentContext();

  // Subscribe to messages so pendingCalls updates reactively
  const [messages, setMessages] = useState(() => chatInternal.getState('messages'));

  useEffect(() => {
    const unsub = chatInternal.subscribe('messages', () => {
      setMessages(chatInternal.getState('messages'));
    });
    return () => unsub();
  }, [chatInternal]);

  const pendingCalls: DisplayToolCall[] = useMemo(
    () => messages.flatMap(
      (m: any) => m.toolCalls?.filter((tc: any) => tc.status === 'pending_approval') || [],
    ),
    [messages],
  );

  return {
    pendingCalls,
    hasPending: chatService.hasPendingApprovals,
    approve: (callId: string) => chatService.approveToolCall(callId),
    reject: (callId: string) => chatService.rejectToolCall(callId),
  };
}
