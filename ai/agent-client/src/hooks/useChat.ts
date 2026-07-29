import { useState, useEffect } from 'react';
import { useAgentContext } from '../service/provider';
import type { PlanProgress } from '../service/chat.service';

/**
 * Chat hook for message interaction.
 * Subscribes to @observable() properties for reactivity.
 */
export function useChat() {
  const { chatService, chatInternal } = useAgentContext();

  // Subscribe to messages for re-renders
  const [messages, setMessages] = useState(() => chatInternal.getState('messages'));
  const [status, setStatus] = useState(() => chatInternal.getState('status'));
  const [lastUsage, setLastUsage] = useState(() => chatInternal.getState('lastUsage'));
  const [activePlan, setActivePlan] = useState<PlanProgress | null>(() => chatInternal.getState('activePlan'));
  const [inputHistory, setInputHistory] = useState<string[]>(() => chatInternal.getState('inputHistory'));
  const [, refreshSessionRouting] = useState(0);

  useEffect(() => {
    const unsubMessages = chatInternal.subscribe('messages', () => {
      setMessages(chatInternal.getState('messages'));
    });
    const unsubStatus = chatInternal.subscribe('status', () => {
      setStatus(chatInternal.getState('status'));
    });
    const unsubUsage = chatInternal.subscribe('lastUsage', () => {
      setLastUsage(chatInternal.getState('lastUsage'));
    });
    const unsubPlan = chatInternal.subscribe('activePlan', () => {
      setActivePlan(chatInternal.getState('activePlan'));
    });
    const unsubInputHistory = chatInternal.subscribe('inputHistory', () => {
      setInputHistory(chatInternal.getState('inputHistory'));
    });
    const refreshRouting = () => refreshSessionRouting((version) => version + 1);
    const unsubActiveSession = chatInternal.subscribe('activeSessionId', refreshRouting);
    const unsubBackgroundSession = chatInternal.subscribe('backgroundSessionId', refreshRouting);
    const unsubRuntimeSession = chatInternal.subscribe('runtimeSessionId', refreshRouting);

    return () => {
      unsubMessages();
      unsubStatus();
      unsubUsage();
      unsubPlan();
      unsubInputHistory();
      unsubActiveSession();
      unsubBackgroundSession();
      unsubRuntimeSession();
    };
  }, [chatInternal]);

  const isStreaming = status === 'running' || status === 'waiting_approval' || !chatService.canSend;

  return {
    messages,
    status,
    isStreaming,
    canSend: chatService.canSend,
    lastUsage,
    activePlan,
    inputHistory,

    send: (content: string, images?: Array<{ data: string; mimeType?: string }>) => chatService.sendMessage(content, images),
    retry: () => chatService.retry(),
    retryFromMessage: (id: string) => chatService.retryFromMessage(id),
    editMessage: (id: string, content: string) => chatService.editMessage(id, content),
    abort: () => chatService.abort(),
    clear: () => {
      chatService.abortIfStreaming();
      return chatService.clearMessages();
    },
  };
}
