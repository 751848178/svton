import type { AgentEvent } from '@earendil-works/pi-agent-core';
import type { AssistantMessage, Usage } from '@earendil-works/pi-ai';
import {
  fauxAssistantMessage,
  fauxText,
  fauxThinking,
} from '@earendil-works/pi-ai';
import type { ToolCall, ToolResult } from '../../src/tool/types';

export interface NativeAssistantLifecycleOptions {
  content?: string;
  usage?: Partial<Usage>;
  stopReason?: AssistantMessage['stopReason'];
  errorMessage?: string;
}

/** Faithful terminal lifecycle whose three events share one assistant object. */
export function nativeAssistantLifecycle(
  options: NativeAssistantLifecycleOptions = {},
): AgentEvent[] {
  const base = fauxAssistantMessage(options.content ?? '', {
    stopReason: options.stopReason ?? 'stop',
    ...(options.errorMessage !== undefined ? { errorMessage: options.errorMessage } : {}),
  });
  const assistant: AssistantMessage = options.usage
    ? { ...base, usage: { ...base.usage, ...options.usage } }
    : base;
  return [
    { type: 'message_end', message: assistant },
    { type: 'turn_end', message: assistant, toolResults: [] },
    { type: 'agent_end', messages: [assistant] },
  ];
}

/** Native bookkeeping between one completed assistant turn and the next. */
export function nativeTurnBoundary(
  completed: AssistantMessage,
  starting: AssistantMessage,
): AgentEvent[] {
  return [
    { type: 'turn_end', message: completed, toolResults: [] },
    { type: 'turn_start' },
    { type: 'message_start', message: starting },
  ];
}

export function nativeTextDelta(text: string): AgentEvent {
  const partial = fauxAssistantMessage([fauxText(text)]);
  return {
    type: 'message_update',
    message: partial,
    assistantMessageEvent: {
      type: 'text_delta',
      contentIndex: 0,
      delta: text,
      partial,
    },
  };
}

export function nativeThinkingDelta(thinking: string): AgentEvent {
  const partial = fauxAssistantMessage([fauxThinking(thinking)]);
  return {
    type: 'message_update',
    message: partial,
    assistantMessageEvent: {
      type: 'thinking_delta',
      contentIndex: 0,
      delta: thinking,
      partial,
    },
  };
}

export function nativeToolStart(call: ToolCall): AgentEvent {
  return {
    type: 'tool_execution_start',
    toolCallId: call.id,
    toolName: call.name,
    args: call.arguments,
  };
}

export function nativeToolUpdate(
  callId: string,
  name: string,
  args: Record<string, unknown>,
  message = '',
): AgentEvent {
  return {
    type: 'tool_execution_update',
    toolCallId: callId,
    toolName: name,
    args,
    partialResult: {
      content: [{ type: 'text', text: message }],
      details: {},
    },
  };
}

export function nativeToolEnd(
  result: ToolResult,
  toolName = 'tool',
): AgentEvent {
  return {
    type: 'tool_execution_end',
    toolCallId: result.callId,
    toolName,
    result: {
      content: [{ type: 'text', text: result.output }],
      details: { metadata: result.metadata },
    },
    isError: result.isError === true,
  };
}

export function nativeError(message: string): AgentEvent {
  return {
    type: 'message_end',
    message: fauxAssistantMessage('', {
      stopReason: 'error',
      errorMessage: message,
    }),
  };
}

export function nativeAgentEnd(
  usage?: Partial<Usage>,
  stopReason: AssistantMessage['stopReason'] = 'stop',
): AgentEvent {
  const assistant = fauxAssistantMessage('', { stopReason });
  const message = usage
    ? { ...assistant, usage: { ...assistant.usage, ...usage } }
    : assistant;
  return { type: 'agent_end', messages: [message] };
}
