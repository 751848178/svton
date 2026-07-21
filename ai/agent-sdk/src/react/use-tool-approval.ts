import { useEffect, useMemo, useState } from 'react';
import { useAgentContext } from './context';
import { getSharedChatMessages, setSharedChatMessages, subscribeSharedChatMessages } from './chat-message-store';
import { getPendingToolCallsFromMessages, updateToolCallStatusInMessages } from './tool-call-status.utils';
import type { DisplayToolCall } from './types';

export interface UseToolApprovalReturn {
  /** Tool calls awaiting user approval */
  pendingCalls: DisplayToolCall[];
  /** Approve a pending tool call by ID */
  approve: (callId: string) => void;
  /** Reject a pending tool call by ID */
  reject: (callId: string) => void;
}

export function useToolApproval(): UseToolApprovalReturn {
  const { agent } = useAgentContext();
  const [messages, setMessages] = useState(() => getSharedChatMessages(agent));

  useEffect(() => subscribeSharedChatMessages(agent, setMessages), [agent]);

  const pendingCalls = useMemo(() => getPendingToolCallsFromMessages(messages), [messages]);

  const approve = (callId: string) => {
    setSharedChatMessages(
      agent,
      updateToolCallStatusInMessages(getSharedChatMessages(agent), callId, 'running'),
    );
    agent.approveToolCall(callId);
  };

  const reject = (callId: string) => {
    setSharedChatMessages(
      agent,
      updateToolCallStatusInMessages(getSharedChatMessages(agent), callId, 'error'),
    );
    agent.rejectToolCall(callId);
  };

  return { pendingCalls, approve, reject };
}
