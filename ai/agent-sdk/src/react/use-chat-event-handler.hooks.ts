import { useCallback } from 'react';
import type { MutableRefObject } from 'react';
import {
  selectLastAssistantMessage,
  selectNativeToolCall,
  selectNativeToolResult,
  selectNativeToolUpdate,
  type PublicRuntimeEvent,
} from '@svton/agent-core';
import type { Usage } from '@earendil-works/pi-ai';
import {
  appendTextDelta,
  appendThinkingDelta,
  appendToolCallStart,
  completeToolCall,
  markToolCallPending,
  readPlanProgress,
  updateToolCallArguments,
  upsertPlanProgressBlock,
} from './chat-event-message.utils';
import { finalizeTurnBlocks } from './chat-turn-blocks.utils';
import type { ChatStatus, DisplayMessage, PlanProgress } from './types';

type MessageUpdater = (msg: DisplayMessage) => DisplayMessage;

interface UseChatEventHandlerOptions {
  updateMessage: (msgId: string, updater: MessageUpdater) => void;
  publishMessages: (updater: (prev: DisplayMessage[]) => DisplayMessage[]) => void;
  createSystemMessage: (summary: string) => DisplayMessage;
  statusRef: MutableRefObject<ChatStatus>;
  thinkingSeparatorPending: MutableRefObject<boolean>;
  setStatus: (status: ChatStatus) => void;
  setLastUsage: (usage: Usage) => void;
  setActivePlan: (plan: PlanProgress) => void;
}

export function useChatEventHandler({
  updateMessage,
  publishMessages,
  createSystemMessage,
  statusRef,
  thinkingSeparatorPending,
  setStatus,
  setLastUsage,
  setActivePlan,
}: UseChatEventHandlerOptions): (event: PublicRuntimeEvent, assistantMsgId: string) => void {
  return useCallback(
    (event: PublicRuntimeEvent, assistantMsgId: string) => {
      switch (event.type) {
        case 'message_update': {
          const update = event.assistantMessageEvent;
          if (update.type === 'text_delta') {
            updateMessage(assistantMsgId, (msg) => appendTextDelta(msg, update.delta));
          } else if (update.type === 'thinking_delta') {
            const sep = thinkingSeparatorPending.current ? '\n---\n' : '';
            updateMessage(assistantMsgId, (msg) =>
              appendThinkingDelta(msg, sep, update.delta),
            );
            thinkingSeparatorPending.current = false;
          }
          break;
        }

        case 'tool_execution_start': {
          const call = selectNativeToolCall(event);
          updateMessage(assistantMsgId, (msg) => appendToolCallStart(msg, call));
          break;
        }

        case 'tool_execution_update': {
          const update = selectNativeToolUpdate(event);
          updateMessage(assistantMsgId, (msg) =>
            updateToolCallArguments(
              msg,
              update.callId,
              update.name,
              update.arguments,
            ),
          );
          break;
        }

        case 'tool_execution_end': {
          const result = selectNativeToolResult(event);
          if (statusRef.current === 'waiting_approval') {
            statusRef.current = 'running';
            setStatus('running');
          }
          const planProgress = readPlanProgress(result);
          if (planProgress) {
            setActivePlan(planProgress);
          }
          updateMessage(assistantMsgId, (msg) => {
            const completed = completeToolCall(msg, result);
            return planProgress ? upsertPlanProgressBlock(completed, planProgress) : completed;
          });
          thinkingSeparatorPending.current = true;
          break;
        }

        case 'tool_approval_needed': {
          statusRef.current = 'waiting_approval';
          setStatus('waiting_approval');
          updateMessage(assistantMsgId, (msg) => markToolCallPending(msg, event.call.id, event.metadata));
          break;
        }

        case 'message_end': {
          if (event.message.role !== 'assistant') break;
          setLastUsage(event.message.usage);
          if (event.message.stopReason === 'error') {
            const error = event.message.errorMessage ?? 'Agent run failed';
            updateMessage(assistantMsgId, (msg) => ({
              ...msg,
              error,
              blocks: [...msg.blocks, { type: 'error', text: error }],
              isStreaming: false,
            }));
            statusRef.current = 'error';
            setStatus('error');
          }
          break;
        }

        case 'context_compacted': {
          publishMessages((prev) => [...prev, createSystemMessage(event.summary)]);
          break;
        }

        case 'warning': {
          updateMessage(assistantMsgId, (msg) => ({
            ...msg,
            blocks: [...msg.blocks, { type: 'warning', text: event.text, source: event.source }],
          }));
          break;
        }

        case 'skill_activated': {
          updateMessage(assistantMsgId, (msg) => ({ ...msg, activeSkills: event.skills }));
          break;
        }

        case 'agent_end': {
          const assistant = selectLastAssistantMessage(event.messages);
          if (assistant) setLastUsage(assistant.usage);
          updateMessage(assistantMsgId, (msg) =>
            finalizeTurnBlocks({
              ...msg,
              isStreaming: false,
              duration: Date.now() - msg.timestamp,
            }),
          );
          if (statusRef.current !== 'waiting_approval' && statusRef.current !== 'error') {
            statusRef.current = 'idle';
            setStatus('idle');
          }
          break;
        }

        case 'agent_start':
        case 'turn_start':
        case 'turn_end':
        case 'message_start':
          break;
      }
    },
    [createSystemMessage, publishMessages, setActivePlan, setLastUsage, setStatus, statusRef, thinkingSeparatorPending, updateMessage],
  );
}
