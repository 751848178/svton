/**
 * useToolApproval — extract pending tool calls from chat messages
 * and provide approve/reject callbacks.
 */

import { useMemo } from 'react';
import { useAgentContext } from './context';
import { useChat } from './use-chat';
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
  const { messages } = useChat();

  const pendingCalls = useMemo(() => {
    const calls: DisplayToolCall[] = [];
    for (const msg of messages) {
      for (const tc of msg.toolCalls) {
        if (tc.status === 'pending_approval') {
          calls.push(tc);
        }
      }
    }
    return calls;
  }, [messages]);

  const approve = (callId: string) => {
    agent.approveToolCall(callId);
  };

  const reject = (callId: string) => {
    agent.rejectToolCall(callId);
  };

  return { pendingCalls, approve, reject };
}
