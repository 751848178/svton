/**
 * Pure display mutators selected from native Pi or capability events.
 *
 * Extracted from the event dispatcher (PI007) so the dispatcher stays a thin
 * switch and each mutator is independently testable. Every mutator is a pure
 * `(message, event, ctx) => message` transform; the dispatcher owns routing
 * (active vs background session) via the message store.
 *
 * The dispatcher owns protocol matching; these functions only update the
 * product display model.
 */

import type { ToolResult } from '@svton/agent-core';
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
  insertThinkingSeparator: boolean;
}

export const CONTEXT_COMPACTED_LABEL = '上下文已压缩';

// ============================================================
// Pi-base: streaming content
// ============================================================

export function applyTextDelta(m: DisplayMessage, text: string, ctx: MutatorContext): DisplayMessage {
  if (m.id !== ctx.assistantMsgId) return m;
  const blocks = [...(m.blocks || [])];
  const last = blocks[blocks.length - 1];
  if (last && last.type === 'text') {
    blocks[blocks.length - 1] = { type: 'text', text: last.text + text };
  } else {
    blocks.push({ type: 'text', text });
  }
  return { ...m, content: m.content + text, blocks };
}

export function applyThinkingDelta(m: DisplayMessage, thinking: string, ctx: MutatorContext): DisplayMessage {
  if (m.id !== ctx.assistantMsgId) return m;
  const separator = ctx.insertThinkingSeparator ? '\n---\n' : '';
  const newThinking = (m.thinking || '') + separator + thinking;
  const blocks = [...(m.blocks || [])];

  // Anthropic encrypted thinking — surface as a redacted marker.
  if (thinking.includes('__REDACTED__') || thinking.startsWith('[REDACTED]')) {
    blocks.push({ type: 'redacted_thinking', reason: 'Provider returned encrypted thinking content' });
    return { ...m, thinking: newThinking, blocks };
  }

  const last = blocks[blocks.length - 1];
  if (last && last.type === 'thinking') {
    blocks[blocks.length - 1] = { type: 'thinking', text: last.text + separator + thinking };
  } else {
    blocks.push({ type: 'thinking', text: thinking });
  }
  return { ...m, thinking: newThinking, blocks };
}

// ============================================================
// Pi-base: tool-call lifecycle
// ============================================================

export function applyToolCallStart(m: DisplayMessage, toolCall: DisplayToolCall, ctx: MutatorContext): DisplayMessage {
  if (m.id !== ctx.assistantMsgId) return m;
  if (m.toolCalls?.some((existing) => existing.id === toolCall.id)) {
    return upsertExistingToolCall(m, toolCall);
  }
  const isSubagent = toolCall.name === 'subagent_spawn' || toolCall.name === 'spawn_subagent';
  const progressBlock = readSlowToolProgressBlock(toolCall.name);
  const blocks = [...(m.blocks || [])];
  if (progressBlock && !isSubagent) blocks.push(progressBlock);
  if (isSubagent) {
    const taskValue = toolCall.arguments.task;
    const task = typeof taskValue === 'string' ? taskValue : 'Subagent task';
    blocks.push({ type: 'subagent', agentId: toolCall.id, task, status: 'running' });
  } else {
    blocks.push({ type: 'tool_call', call: toolCall });
  }
  return { ...m, toolCalls: [...(m.toolCalls || []), toolCall], blocks };
}

function upsertExistingToolCall(
  message: DisplayMessage,
  toolCall: DisplayToolCall,
): DisplayMessage {
  const toolCalls = (message.toolCalls || []).map((existing) =>
    existing.id === toolCall.id ? { ...existing, ...toolCall } : existing,
  );
  const blocks = (message.blocks || []).map((block) => {
    if (block.type === 'tool_call' && block.call.id === toolCall.id) {
      return { ...block, call: { ...block.call, ...toolCall } };
    }
    if (block.type === 'subagent' && block.agentId === toolCall.id) {
      const task = toolCall.arguments.task;
      return {
        ...block,
        task: typeof task === 'string' ? task : block.task,
        status: 'running' as const,
      };
    }
    return block;
  });
  return { ...message, toolCalls, blocks };
}

export function applyToolExecutionUpdate(
  m: DisplayMessage,
  update: { callId: string; name?: string; arguments: Record<string, unknown> },
): DisplayMessage {
  const callId = update.callId;
  const updatedCalls = (m.toolCalls || []).map((tc) =>
    tc.id === callId
      ? { ...tc, name: update.name ?? tc.name, arguments: update.arguments }
      : tc,
  );
  const blocks = (m.blocks || []).map((b) => {
    if (b.type !== 'tool_call' || b.call.id !== callId) return b;
    const name = update.name ?? b.call.name;
    const args = update.arguments;
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
    blocks: insertSlowToolProgressBlock(blocks, callId, update.name),
  };
}

export function applyToolCallEnd(
  m: DisplayMessage,
  result: ToolResult,
  toolName: string,
  owningCall: DisplayToolCall | undefined,
): DisplayMessage {
  if (owningCall?.status === 'completed' || owningCall?.status === 'error') return m;
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

export function applyError(m: DisplayMessage, error: string, ctx: MutatorContext): DisplayMessage {
  if (m.id !== ctx.assistantMsgId) return m;
  const blocks = [...(m.blocks || [])];
  blocks.push({ type: 'error', text: error });
  return { ...m, error, blocks };
}

export function applyTurnFinalized(m: DisplayMessage, ctx: MutatorContext): DisplayMessage {
  if (m.id !== ctx.assistantMsgId) return m;
  return finalizeTurnBlocks(m);
}

// ============================================================
// svton-only: capability events
// ============================================================

export function applyWarning(m: DisplayMessage, text: string, source: string | undefined, ctx: MutatorContext): DisplayMessage {
  if (m.id !== ctx.assistantMsgId) return m;
  const blocks = [...(m.blocks || [])];
  blocks.push({ type: 'warning', text, source });
  return { ...m, blocks };
}

export function applySkillActivated(m: DisplayMessage, skills: string[], ctx: MutatorContext): DisplayMessage {
  if (m.id !== ctx.assistantMsgId) return m;
  return { ...m, activeSkills: skills };
}
