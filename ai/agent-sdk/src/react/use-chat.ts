import { useCallback, useEffect, useRef, useState } from 'react';
import type { SetStateAction } from 'react';
import type { TokenUsage } from '@svton/agent-core';
import type { Agent } from '../agent';
import { useAgentContext } from './context';
import type { ChatStatus, DisplayMessage, PlanProgress } from './types';
import { isActiveChatStatus } from './use-chat-status.utils';
import { getSharedChatMessages, setSharedChatMessages, subscribeSharedChatMessages } from './chat-message-store';
import { buildChatContent } from './chat-content.utils';
import { useChatEventHandler } from './use-chat-event-handler.hooks';
import { finalizeAbortedMessages, hasPendingToolCallsInMessages } from './tool-call-status.utils';

export interface UseChatReturn {
  messages: DisplayMessage[];
  status: ChatStatus;
  isStreaming: boolean;
  lastUsage: TokenUsage | null;
  activePlan: PlanProgress | null;
  send: (message: string, images?: Array<{ data: string; mimeType?: string }>) => void;
  abort: () => void;
  clear: () => void;
}

let msgCounter = 0;

function createMessage(
  role: DisplayMessage['role'],
  content: string,
  extra?: Partial<DisplayMessage>,
): DisplayMessage {
  return {
    id: `msg_${++msgCounter}`,
    role,
    content,
    toolCalls: [],
    blocks: [],
    timestamp: Date.now(),
    ...extra,
  };
}

export function useChat(): UseChatReturn {
  const { agent } = useAgentContext();

  const [messages, setMessages] = useState<DisplayMessage[]>(() => getSharedChatMessages(agent));
  const [status, setStatus] = useState<ChatStatus>('idle');
  const [lastUsage, setLastUsage] = useState<TokenUsage | null>(null);
  const [activePlan, setActivePlan] = useState<PlanProgress | null>(null);

  const statusRef = useRef<ChatStatus>('idle');
  const lastEventType = useRef<string | null>(null);
  const runSeqRef = useRef(0);

  useEffect(() => subscribeSharedChatMessages(agent, setMessages), [agent]);

  const publishMessages = useCallback((next: SetStateAction<DisplayMessage[]>) => {
    setMessages((prev) => {
      const messagesNext = typeof next === 'function'
        ? (next as (prev: DisplayMessage[]) => DisplayMessage[])(prev)
        : next;
      setSharedChatMessages(agent, messagesNext);
      return messagesNext;
    });
  }, [agent]);

  const updateMessage = useCallback(
    (msgId: string, updater: (msg: DisplayMessage) => DisplayMessage) => {
      publishMessages((prev) => prev.map((m) => (m.id === msgId ? updater(m) : m)));
    },
    [publishMessages],
  );

  const createSystemMessage = useCallback(
    (summary: string) => createMessage('system', summary, { systemType: 'context_compacted' }),
    [],
  );

  const handleEvent = useChatEventHandler({
    updateMessage,
    publishMessages,
    createSystemMessage,
    statusRef,
    lastEventType,
    setStatus,
    setLastUsage,
    setActivePlan,
  });

  const send = useCallback(
    (message: string, images?: Array<{ data: string; mimeType?: string }>) => {
      if (
        isActiveChatStatus(statusRef.current)
        || hasPendingToolCallsInMessages(getSharedChatMessages(agent))
      ) return;

      const userMsg = createMessage('user', message, {
        images: images?.length ? images : undefined,
      });
      publishMessages((prev) => [...prev, userMsg]);

      const assistantMsg = createMessage('assistant', '', { isStreaming: true });
      publishMessages((prev) => [...prev, assistantMsg]);

      statusRef.current = 'running';
      lastEventType.current = null;
      setStatus('running');

      const runId = assistantMsg.id;
      const runSeq = ++runSeqRef.current;

      const content = buildChatContent(message, images);

      (async () => {
        try {
          for await (const event of agent.chat(content)) {
            if (runSeq !== runSeqRef.current) {
              break;
            }
            if (statusRef.current === 'idle' || statusRef.current === 'error') {
              break;
            }
            handleEvent(event, runId);
          }
        } catch (err) {
          if (runSeq !== runSeqRef.current || statusRef.current === 'idle' || statusRef.current === 'error') {
            return;
          }
          const errorMsg = err instanceof Error ? err.message : String(err);
          updateMessage(runId, (msg) => ({
            ...msg,
            error: errorMsg,
            blocks: [...msg.blocks, { type: 'error', text: errorMsg }],
            isStreaming: false,
          }));
          statusRef.current = 'error';
          setStatus('error');
        }
      })();
    },
    [agent, handleEvent, updateMessage],
  );

  const abort = useCallback(() => {
    runSeqRef.current += 1;
    agent.abort();
    publishMessages(finalizeAbortedMessages);
    statusRef.current = 'idle';
    setStatus('idle');
  }, [agent, publishMessages]);

  const clear = useCallback(() => {
    runSeqRef.current += 1;
    if (
      isActiveChatStatus(statusRef.current)
      || hasPendingToolCallsInMessages(getSharedChatMessages(agent))
    ) {
      agent.abort();
    }
    agent.setMessages([]);
    publishMessages([]);
    setStatus('idle');
    setLastUsage(null);
    setActivePlan(null);
    statusRef.current = 'idle';
  }, [agent, publishMessages]);

  const visibleStatus: ChatStatus = hasPendingToolCallsInMessages(messages)
    ? 'waiting_approval'
    : status;

  return {
    messages,
    status: visibleStatus,
    isStreaming: isActiveChatStatus(visibleStatus),
    lastUsage,
    activePlan,
    send,
    abort,
    clear,
  };
}
