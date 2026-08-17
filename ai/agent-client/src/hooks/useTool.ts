import { useEffect, useState } from 'react';
import type { ToolApprovalDecision } from '@svton/agent-core';
import { useAgentContext } from '../service/provider';

/** Typed active-session selector for the session-owned live approval queue. */
export function useToolApproval() {
  const { chatService, chatInternal } = useAgentContext();
  const [, refresh] = useState(0);

  useEffect(() => {
    const update = () => refresh((version) => version + 1);
    const unsubVersion = chatInternal.subscribe('pendingApprovalVersion', update);
    const unsubSession = chatInternal.subscribe('activeSessionId', update);
    return () => {
      unsubVersion();
      unsubSession();
    };
  }, [chatInternal]);

  const request = chatService.getPendingApproval();
  return {
    request,
    pendingCalls: chatService.getPendingToolCalls(),
    hasPending: request !== null,
    settle: (requestId: string, decision: ToolApprovalDecision) =>
      chatService.settleToolApproval(requestId, decision),
    approve: (callId: string) => chatService.approveToolCall(callId),
    reject: (callId: string) => chatService.rejectToolCall(callId),
  };
}
