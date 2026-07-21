import { useState, useEffect, useMemo } from 'react';
import { useAgentContext } from '../service/provider';
import type { DisplayToolCall } from '../service/chat.service';
import {
  getVisiblePendingToolCalls,
  mergeRuntimePendingToolCalls,
} from './use-tool-approval.utils';

/**
 * Tool approval hook.
 * Subscribes to messages observable to reactively derive pending tool calls.
 */
export function useToolApproval() {
  const { chatService, chatInternal } = useAgentContext();

  // Subscribe to messages so pendingCalls updates reactively
  const [messages, setMessages] = useState(() => chatInternal.getState('messages'));
  const [pendingApprovalVersion, setPendingApprovalVersion] = useState(
    () => chatInternal.getState('pendingApprovalVersion'),
  );

  useEffect(() => {
    const unsub = chatInternal.subscribe('messages', () => {
      setMessages(chatInternal.getState('messages'));
    });
    const unsubPending = chatInternal.subscribe('pendingApprovalVersion', () => {
      setPendingApprovalVersion(chatInternal.getState('pendingApprovalVersion'));
    });
    return () => {
      unsub();
      unsubPending();
    };
  }, [chatInternal]);

  const pendingCalls: DisplayToolCall[] = useMemo(() => {
    const visible = getVisiblePendingToolCalls(messages);
    return mergeRuntimePendingToolCalls(visible, chatService.getPendingToolCalls());
  }, [messages, chatService, pendingApprovalVersion]);

  return {
    pendingCalls,
    hasPending: pendingCalls.length > 0,
    approve: (callId: string) => chatService.approveToolCall(callId),
    reject: (callId: string) => chatService.rejectToolCall(callId),
  };
}
