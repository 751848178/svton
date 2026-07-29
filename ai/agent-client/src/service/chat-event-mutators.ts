/**
 * Pure per-event display mutators — one function per AgentEvent variant.
 *
 * Extracted from the event dispatcher (PI007) so the dispatcher stays a thin
 * switch and each mutator is independently testable. Every mutator is a pure
 * `(message, event, ctx) => message` transform; the dispatcher owns routing
 * (active vs background session) via the message store.
 *
 * Classification mirrors the AgentEvent union doc (agent/types.ts):
 *   Pi-base: text, thinking, tool_call_*, error, done
 *   svton-only: tool_approval_needed, context_compacted, skill_activated, warning
 */

import type { AgentEvent } from '@svton/agent-core';
import type { DisplayMessage, DisplayToolCall } from '../types';
import {
  appendToolResultMetadataBlocks,
} from './chat-tool-result-blocks.utils';
import {
  insertSlowToolProgressBlock,
  markSlowToolProgressBlockDone,
  readSlowToolProgressBlock,
} from './chat-tool-progress-block.utils';
import { finalizeTurnBlocks } from './chat-turn-blocks.utils';

export interface MutatorContext {
  assistantMsgId: string;
  /** Previous event type — used to insert thinking separators after tool calls. */
  lastEventType: string | null;
}

export const CONTEXT_COMPACTED_LABEL = '上下文已压缩';

// ============================================================
// Pi-base: streaming content
// ============================================================

export function applyTextDelta(m: DisplayMessage, event: Extract<AgentEvent, { type: 'text_delta' }>, ctx: MutatorContext): DisplayMessage {
  if (m.id !== ctx.assistantMsgId) return m;
  const blocks = [...(m.blocks || [])];
  const last = blocks[blocks.length - 1];
  if (last && last.type === 'text') {
    blocks[blocks.length - 1] = { type: 'text', text: last.text + event.text };
  } else {
    blocks.push({ type: 'text', text: event.text });
  }
  return { ...m, content: m.content + event.text, blocks };
}

export function applyThinkingDelta(m: DisplayMessage, event: Extract<AgentEvent, { type: 'thinking_delta' }>, ctx: MutatorContext): DisplayMessage {
  if (m.id !== ctx.assistantMsgId) return m;
  const separator = ctx.lastEventType === 'tool_call_end' || ctx.lastEventType === 'done' ? '\n---\n' : '';
  const newThinking = (m.thinking || '') + separator + event.thinking;
  const blocks = [...(m.blocks || [])];

  // Anthropic encrypted thinking — surface as a redacted marker.
  if (event.thinking.includes('__REDACTED__') || event.thinking.startsWith('[REDACTED]')) {
    blocks.push({ type: 'redacted_thinking', reason: 'Provider returned encrypted thinking content' });
    return { ...m, thinking: newThinking, blocks };
  }

  const last = blocks[blocks.length - 1];
  if (last && last.type === 'thinking') {
    blocks[blocks.length - 1] = { type: 'thinking', text: last.text + separator + event.thinking };
  } else {
    blocks.push({ type: 'thinking', text: event.thinking });
  }
  return { ...m, thinking: newThinking, blocks };
}

// ============================================================
// Pi-base: tool-call lifecycle
// ============================================================

export function applyToolCallStart(m: DisplayMessage, event: Extract<AgentEvent, { type: 'tool_call_start' }>, ctx: MutatorContext): DisplayMessage {
  if (m.id !== ctx.assistantMsgId) return m;
  const toolCall: DisplayToolCall = {
    id: event.call.id,
    name: event.call.name,
    arguments: event.call.arguments,
    status: 'running',
  };
  const isSubagent = event.call.name === 'subagent_spawn' || event.call.name === 'spawn_subagent';
  const progressBlock = readSlowToolProgressBlock(event.call.name);
  const blocks = [...(m.blocks || [])];
  if (progressBlock && !isSubagent) blocks.push(progressBlock);
  if (isSubagent) {
    const task = (event.call.arguments as Record<string, unknown> | undefined)?.task as string || 'Subagent task';
    blocks.push({ type: 'subagent', agentId: event.call.id, task, status: 'running' });
  } else {
    blocks.push({ type: 'tool_call', call: toolCall });
  }
  return { ...m, toolCalls: [...(m.toolCalls || []), toolCall], blocks };
}

export function applyToolCallProgress(m: DisplayMessage, event: Extract<AgentEvent, { type: 'tool_call_progress' }>): DisplayMessage {
  const callId = event.callId;
  const updatedCalls = (m.toolCalls || []).map((tc) =>
    tc.id === callId
      ? { ...tc, name: event.name ?? tc.name, arguments: event.arguments ?? tc.arguments }
      : tc,
  );
  const blocks = (m.blocks || []).map((b) => {
    if (b.type !== 'tool_call' || b.call.id !== callId) return b;
    const name = event.name ?? b.call.name;
    const args = event.arguments ?? b.call.arguments;
    if (name === 'subagent_spawn' || name === 'spawn_subagent') {
      const task = (args as Record<string, unknown> | undefined)?.task;
      return {
        type: 'subagent' as const,
        agentId: callId,
        task: typeof task === 'string' && task.trim().length > 0 ? task : 'Subagent task',
        status: 'running' as const,
      };
    }
    return { ...b, call: { ...b.call, name, arguments: args } };
  });
  return {
    ...m,
    toolCalls: updatedCalls,
    blocks: insertSlowToolProgressBlock(blocks, callId, event.name),
  };
}

export function applyToolCallEnd(
  m: DisplayMessage,
  event: Extract<AgentEvent, { type: 'tool_call_end' }>,
  toolName: string,
  owningCall: DisplayToolCall | undefined,
): DisplayMessage {
  const { result } = event;
  const endStatus = result.isError ? 'error' as const : 'completed' as const;
  const updatedCalls = (m.toolCalls || []).map((tc) =>
    tc.id === result.callId ? { ...tc, result, status: endStatus } : tc,
  );
  let blocks = (m.blocks || []).map((b) => {
    if (b.type === 'tool_call' && b.call.id === result.callId) {
      return { ...b, call: { ...b.call, result, status: endStatus } };
    }
    if (b.type === 'subagent' && b.agentId === result.callId) {
      return { ...b, status: result.isError ? 'error' as const : 'completed' as const, summary: result.output };
    }
    return b;
  });
  blocks = appendToolResultMetadataBlocks(blocks, toolName, result, owningCall);
  blocks = markSlowToolProgressBlockDone(blocks, result.callId);
  return { ...m, toolCalls: updatedCalls, blocks };
}

// ============================================================
// Pi-base: termination
// ============================================================

export function applyError(m: DisplayMessage, event: Extract<AgentEvent, { type: 'error' }>, ctx: MutatorContext): DisplayMessage {
  if (m.id !== ctx.assistantMsgId) return m;
  const blocks = [...(m.blocks || [])];
  blocks.push({ type: 'error', text: event.error.message });
  return { ...m, error: event.error.message, blocks };
}

export function applyDone(m: DisplayMessage, ctx: MutatorContext): DisplayMessage {
  if (m.id !== ctx.assistantMsgId) return m;
  return finalizeTurnBlocks(m);
}

// ============================================================
// svton-only: capability events
// ============================================================

export function applyWarning(m: DisplayMessage, event: Extract<AgentEvent, { type: 'warning' }>, ctx: MutatorContext): DisplayMessage {
  if (m.id !== ctx.assistantMsgId) return m;
  const blocks = [...(m.blocks || [])];
  blocks.push({ type: 'warning', text: event.text, source: event.source });
  return { ...m, blocks };
}

export function applySkillActivated(m: DisplayMessage, event: Extract<AgentEvent, { type: 'skill_activated' }>, ctx: MutatorContext): DisplayMessage {
  if (m.id !== ctx.assistantMsgId) return m;
  return { ...m, activeSkills: event.skills };
}
