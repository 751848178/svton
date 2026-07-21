import { useCallback } from 'react';
import type { MutableRefObject } from 'react';
import type { AgentEvent, TokenUsage } from '@svton/agent-core';
import {
  appendSubagentStart,
  appendTextDelta,
  appendThinkingDelta,
  appendToolCallStart,
  completeSubagent,
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
  lastEventType: MutableRefObject<string | null>;
  setStatus: (status: ChatStatus) => void;
  setLastUsage: (usage: TokenUsage) => void;
  setActivePlan: (plan: PlanProgress) => void;
}

export function useChatEventHandler({
  updateMessage,
  publishMessages,
  createSystemMessage,
  statusRef,
  lastEventType,
  setStatus,
  setLastUsage,
  setActivePlan,
}: UseChatEventHandlerOptions): (event: AgentEvent, assistantMsgId: string) => void {
  return useCallback(
    (event: AgentEvent, assistantMsgId: string) => {
      switch (event.type) {
        case 'text_delta': {
          updateMessage(assistantMsgId, (msg) => appendTextDelta(msg, event.text));
          break;
        }

        case 'thinking_delta': {
          const sep =
            lastEventType.current === 'tool_call_end' || lastEventType.current === 'done'
              ? '\n---\n'
              : '';
          updateMessage(assistantMsgId, (msg) => appendThinkingDelta(msg, sep, event.thinking));
          break;
        }

        case 'tool_call_start': {
          updateMessage(assistantMsgId, (msg) => appendToolCallStart(msg, event.call));
          break;
        }

        case 'tool_call_progress': {
          updateMessage(assistantMsgId, (msg) =>
            updateToolCallArguments(msg, event.callId, event.name, event.arguments),
          );
          break;
        }

        case 'tool_call_end': {
          if (statusRef.current === 'waiting_approval') {
            statusRef.current = 'running';
            setStatus('running');
          }
          const planProgress = readPlanProgress(event.result);
          if (planProgress) {
            setActivePlan(planProgress);
          }
          updateMessage(assistantMsgId, (msg) => {
            const completed = completeToolCall(msg, event.result);
            return planProgress ? upsertPlanProgressBlock(completed, planProgress) : completed;
          });
          break;
        }

        case 'tool_approval_needed': {
          statusRef.current = 'waiting_approval';
          setStatus('waiting_approval');
          updateMessage(assistantMsgId, (msg) => markToolCallPending(msg, event.call.id, event.metadata));
          break;
        }

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

        case 'done': {
          setLastUsage(event.usage);
          updateMessage(assistantMsgId, (msg) =>
            finalizeTurnBlocks({
              ...msg,
              isStreaming: false,
              duration: Date.now() - msg.timestamp,
            }),
          );
          if (statusRef.current !== 'waiting_approval') {
            statusRef.current = 'idle';
            setStatus('idle');
          }
          break;
        }

        case 'subagent_start': {
          updateMessage(assistantMsgId, (msg) => appendSubagentStart(msg, event.agentId, event.task));
          break;
        }

        case 'subagent_end': {
          updateMessage(assistantMsgId, (msg) => completeSubagent(msg, event.agentId, event.summary));
          break;
        }
      }

      lastEventType.current = event.type;
    },
    [createSystemMessage, lastEventType, publishMessages, setActivePlan, setLastUsage, setStatus, statusRef, updateMessage],
  );
}
