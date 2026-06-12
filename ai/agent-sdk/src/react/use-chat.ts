/**
 * useChat — core React hook for streaming agent chat.
 *
 * Manages message accumulation, status, and tool approval state
 * using plain useState/useRef (no external state library).
 */

import { useCallback, useRef, useState } from 'react';
import type { AgentEvent, ContentBlock as CoreContentBlock, ToolResult, TokenUsage } from '@svton/agent-core';
import type { Agent } from '../agent';
import { useAgentContext } from './context';
import type { ChatStatus, DisplayMessage, DisplayToolCall, ContentBlock } from './types';

// ============================================================
// Return type
// ============================================================

export interface UseChatReturn {
  messages: DisplayMessage[];
  status: ChatStatus;
  isStreaming: boolean;
  lastUsage: TokenUsage | null;
  send: (message: string, images?: Array<{ data: string; mimeType?: string }>) => void;
  abort: () => void;
  clear: () => void;
}

// ============================================================
// Helper: create a new DisplayMessage
// ============================================================

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

// ============================================================
// useChat implementation
// ============================================================

export function useChat(): UseChatReturn {
  const { agent } = useAgentContext();

  // --- React state (triggers re-render) ---
  const [messages, setMessages] = useState<DisplayMessage[]>([]);
  const [status, setStatus] = useState<ChatStatus>('idle');
  const [lastUsage, setLastUsage] = useState<TokenUsage | null>(null);

  // --- Mutable refs (no re-render) ---
  const statusRef = useRef<ChatStatus>('idle');
  const pendingToolCalls = useRef(
    new Map<string, { call: import('@svton/agent-core').ToolCall; resolve: (approved: boolean) => void }>(),
  );
  const lastEventType = useRef<string | null>(null);
  const abortRef = useRef<(() => void) | null>(null);

  // --- Update a message in the array immutably ---
  const updateMessage = useCallback(
    (msgId: string, updater: (msg: DisplayMessage) => DisplayMessage) => {
      setMessages((prev) => prev.map((m) => (m.id === msgId ? updater(m) : m)));
    },
    [],
  );

  // ============================================================
  // Event handling (ported from ChatService.handleEvent)
  // ============================================================

  const handleEvent = useCallback(
    (event: AgentEvent, assistantMsgId: string) => {
      switch (event.type) {
        // ---- Text ----
        case 'text_delta': {
          updateMessage(assistantMsgId, (msg) => {
            const newContent = msg.content + event.text;
            const blocks = [...msg.blocks];
            const last = blocks[blocks.length - 1];
            if (last && last.type === 'text') {
              blocks[blocks.length - 1] = { type: 'text', text: last.text + event.text };
            } else {
              blocks.push({ type: 'text', text: event.text });
            }
            return { ...msg, content: newContent, blocks };
          });
          break;
        }

        // ---- Thinking ----
        case 'thinking_delta': {
          updateMessage(assistantMsgId, (msg) => {
            const sep =
              lastEventType.current === 'tool_call_end' || lastEventType.current === 'done'
                ? '\n---\n'
                : '';
            const newThinking = (msg.thinking ?? '') + sep + event.thinking;
            const blocks = [...msg.blocks];
            const last = blocks[blocks.length - 1];
            if (last && last.type === 'thinking') {
              blocks[blocks.length - 1] = {
                type: 'thinking',
                text: last.text + sep + event.thinking,
              };
            } else {
              blocks.push({ type: 'thinking', text: sep + event.thinking });
            }
            return { ...msg, thinking: newThinking, blocks };
          });
          break;
        }

        // ---- Tool Call Start ----
        case 'tool_call_start': {
          const call: DisplayToolCall = {
            id: event.call.id,
            name: event.call.name,
            arguments: event.call.arguments,
            status: 'running',
          };
          updateMessage(assistantMsgId, (msg) => ({
            ...msg,
            toolCalls: [...msg.toolCalls, call],
            blocks: [...msg.blocks, { type: 'tool_call', call }],
          }));
          break;
        }

        // ---- Tool Call Progress ----
        case 'tool_call_progress': {
          updateMessage(assistantMsgId, (msg) => {
            const toolCalls = msg.toolCalls.map((tc) =>
              tc.id === event.callId ? { ...tc, arguments: event.arguments ?? tc.arguments } : tc,
            );
            const blocks = msg.blocks.map((b) =>
              b.type === 'tool_call' && b.call.id === event.callId
                ? { ...b, call: { ...b.call, arguments: event.arguments ?? b.call.arguments } }
                : b,
            );
            return { ...msg, toolCalls, blocks };
          });
          break;
        }

        // ---- Tool Call End ----
        case 'tool_call_end': {
          const result: ToolResult = event.result;
          updateMessage(assistantMsgId, (msg) => {
            const toolCalls = msg.toolCalls.map((tc) =>
              tc.id === result.callId
                ? { ...tc, result, status: (result.isError ? 'error' : 'completed') as DisplayToolCall['status'] }
                : tc,
            );
            const blocks = msg.blocks.map((b) =>
              b.type === 'tool_call' && b.call.id === result.callId
                ? {
                    ...b,
                    call: {
                      ...b.call,
                      result,
                      status: (result.isError ? 'error' : 'completed') as DisplayToolCall['status'],
                    },
                  }
                : b,
            );
            return { ...msg, toolCalls, blocks };
          });
          break;
        }

        // ---- Tool Approval Needed ----
        case 'tool_approval_needed': {
          statusRef.current = 'waiting_approval';
          setStatus('waiting_approval');
          updateMessage(assistantMsgId, (msg) => {
            const toolCalls = msg.toolCalls.map((tc) =>
              tc.id === event.call.id ? { ...tc, status: 'pending_approval' as const } : tc,
            );
            const blocks = msg.blocks.map((b) =>
              b.type === 'tool_call' && b.call.id === event.call.id
                ? { ...b, call: { ...b.call, status: 'pending_approval' as const } }
                : b,
            );
            return { ...msg, toolCalls, blocks };
          });
          break;
        }

        // ---- Error ----
        case 'error': {
          updateMessage(assistantMsgId, (msg) => ({
            ...msg,
            error: event.error.message,
            blocks: [...msg.blocks, { type: 'error', text: event.error.message }],
            isStreaming: false,
          }));
          statusRef.current = 'error';
          setStatus('error');
          break;
        }

        // ---- Context Compacted ----
        case 'context_compacted': {
          const sysMsg = createMessage('system', event.summary, {
            systemType: 'context_compacted',
          });
          setMessages((prev) => [...prev, sysMsg]);
          break;
        }

        // ---- Done ----
        case 'done': {
          setLastUsage(event.usage);
          updateMessage(assistantMsgId, (msg) => ({
            ...msg,
            isStreaming: false,
            duration: Date.now() - msg.timestamp,
          }));
          if (statusRef.current !== 'waiting_approval') {
            statusRef.current = 'idle';
            setStatus('idle');
          }
          break;
        }

        // ---- Subagent events (informational) ----
        case 'subagent_start':
        case 'subagent_end':
          // No UI update needed for now
          break;
      }

      lastEventType.current = event.type;
    },
    [updateMessage],
  );

  // ============================================================
  // send()
  // ============================================================

  const send = useCallback(
    (message: string, images?: Array<{ data: string; mimeType?: string }>) => {
      if (statusRef.current === 'running') return;

      // 1. Add user message
      const userMsg = createMessage('user', message, {
        images: images?.length ? images : undefined,
      });
      setMessages((prev) => [...prev, userMsg]);

      // 2. Create placeholder assistant message
      const assistantMsg = createMessage('assistant', '', { isStreaming: true });
      setMessages((prev) => [...prev, assistantMsg]);

      // 3. Start streaming
      statusRef.current = 'running';
      lastEventType.current = null;
      setStatus('running');

      const runId = assistantMsg.id;

      // Build structured content if images present
      let content: string | CoreContentBlock[];
      if (images && images.length > 0) {
        content = [
          { type: 'text' as const, text: message },
          ...images.map(
            (img): CoreContentBlock => ({
              type: 'image' as const,
              data: img.data,
              mimeType: img.mimeType,
            }),
          ),
        ];
      } else {
        content = message;
      }

      // Run async — process events
      (async () => {
        try {
          for await (const event of agent.chat(content)) {
            // Check if aborted
            if (statusRef.current === 'idle' && lastEventType.current !== 'done') {
              break;
            }
            handleEvent(event, runId);
          }
        } catch (err) {
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

  // ============================================================
  // abort()
  // ============================================================

  const abort = useCallback(() => {
    agent.abort();
    statusRef.current = 'idle';
    setStatus('idle');
  }, [agent]);

  // ============================================================
  // clear()
  // ============================================================

  const clear = useCallback(() => {
    agent.setMessages([]);
    setMessages([]);
    setStatus('idle');
    setLastUsage(null);
    statusRef.current = 'idle';
    pendingToolCalls.current.clear();
  }, [agent]);

  return {
    messages,
    status,
    isStreaming: status === 'running',
    lastUsage,
    send,
    abort,
    clear,
  };
}
