import type { ToolCall, ToolResult } from '@svton/agent-core';
import {
  appendToolResultMetadataBlocks,
  readPlanProgress,
} from './chat-tool-result-blocks.utils';
import {
  insertSlowToolProgressBlock,
  markSlowToolProgressBlockDone,
  readSlowToolProgressBlock,
} from './chat-event-tool-progress.utils';
import type { DisplayMessage, DisplayToolCall, PlanProgress } from './types';

export { readPlanProgress };

export function appendTextDelta(msg: DisplayMessage, text: string): DisplayMessage {
  const blocks = [...msg.blocks];
  const last = blocks[blocks.length - 1];
  if (last && last.type === 'text') {
    blocks[blocks.length - 1] = { type: 'text', text: last.text + text };
  } else {
    blocks.push({ type: 'text', text });
  }
  return { ...msg, content: msg.content + text, blocks };
}

export function appendThinkingDelta(msg: DisplayMessage, sep: string, thinking: string): DisplayMessage {
  const blocks = [...msg.blocks];
  const thinkingText = sep + thinking;
  if (isRedactedThinking(thinking)) {
    blocks.push({ type: 'redacted_thinking', reason: 'Provider returned encrypted thinking content' });
    return { ...msg, thinking: (msg.thinking ?? '') + thinkingText, blocks };
  }

  const last = blocks[blocks.length - 1];
  if (last && last.type === 'thinking') {
    blocks[blocks.length - 1] = { type: 'thinking', text: last.text + thinkingText };
  } else {
    blocks.push({ type: 'thinking', text: thinkingText });
  }
  return { ...msg, thinking: (msg.thinking ?? '') + thinkingText, blocks };
}

export function updateToolCallArguments(
  msg: DisplayMessage,
  callId: string,
  name: string | undefined,
  args: Record<string, unknown> | undefined,
): DisplayMessage {
  const toolCalls = msg.toolCalls.map((tc) =>
    tc.id === callId ? { ...tc, name: name ?? tc.name, arguments: args ?? tc.arguments } : tc,
  );
  const blocks = msg.blocks.map((block) => {
    if (block.type !== 'tool_call' || block.call.id !== callId) return block;
    const nextName = name ?? block.call.name;
    const nextArgs = args ?? block.call.arguments;
    if (isSubagentToolName(nextName)) {
      return {
        type: 'subagent' as const,
        agentId: callId,
        task: getSubagentTask(nextArgs),
        status: toSubagentBlockStatus(block.call.status),
      };
    }
    return { ...block, call: { ...block.call, name: nextName, arguments: nextArgs } };
  });
  return { ...msg, toolCalls, blocks: insertSlowToolProgressBlock(blocks, callId, name) };
}

export function appendToolCallStart(msg: DisplayMessage, call: ToolCall): DisplayMessage {
  const isSubagent = isSubagentToolName(call.name);
  const displayCall: DisplayToolCall = {
    id: call.id,
    name: call.name,
    arguments: call.arguments,
    status: 'running',
  };
  const block = isSubagent
    ? { type: 'subagent' as const, agentId: call.id, task: getSubagentTask(call.arguments), status: 'running' as const }
    : { type: 'tool_call' as const, call: displayCall };
  const progressBlock = readSlowToolProgressBlock(call.name);
  const blocks = [
    ...msg.blocks,
    ...(progressBlock && !isSubagent ? [progressBlock] : []),
    block,
  ];

  return {
    ...msg,
    toolCalls: [...msg.toolCalls, displayCall],
    blocks,
  };
}

export function completeToolCall(msg: DisplayMessage, result: ToolResult): DisplayMessage {
  const status = (result.isError ? 'error' : 'completed') as DisplayToolCall['status'];
  const completedCall = msg.toolCalls.find((tc) => tc.id === result.callId);
  const toolCalls = msg.toolCalls.map((tc) =>
    tc.id === result.callId ? { ...tc, result, status } : tc,
  );
  let blocks = msg.blocks.map((block) => {
    if (block.type === 'tool_call' && block.call.id === result.callId) {
      return { ...block, call: { ...block.call, result, status } };
    }
    if (block.type === 'subagent' && block.agentId === result.callId && isSubagentToolName(completedCall?.name)) {
      return { ...block, status: toSubagentBlockStatus(status), summary: result.output };
    }
    return block;
  });
  blocks = markSlowToolProgressBlockDone(blocks, result.callId);
  const completed = { ...msg, toolCalls, blocks };
  return appendToolResultMetadataBlocks(completed, completedCall, result);
}

export function upsertPlanProgressBlock(msg: DisplayMessage, progress: PlanProgress): DisplayMessage {
  const blocks = [...msg.blocks];
  const existingIndex = blocks.findIndex((block) => block.type === 'plan' && block.plan.planId === progress.planId);
  const planBlock = { type: 'plan' as const, plan: progress };
  if (existingIndex >= 0) {
    blocks[existingIndex] = planBlock;
  } else {
    blocks.push(planBlock);
  }
  return { ...msg, blocks };
}

export function markToolCallPending(
  msg: DisplayMessage,
  callId: string,
  metadata?: Record<string, unknown>,
): DisplayMessage {
  const updates = metadata
    ? { status: 'pending_approval' as const, metadata }
    : { status: 'pending_approval' as const };
  const toolCalls = msg.toolCalls.map((tc) =>
    tc.id === callId ? { ...tc, ...updates } : tc,
  );
  const blocks = msg.blocks.map((block) =>
    block.type === 'tool_call' && block.call.id === callId
      ? { ...block, call: { ...block.call, ...updates } }
      : block.type === 'subagent' && block.agentId === callId
        ? { ...block, status: 'pending' as const }
      : block,
  );
  return { ...msg, toolCalls, blocks };
}

export function appendSubagentStart(msg: DisplayMessage, agentId: string, task: string): DisplayMessage {
  return {
    ...msg,
    blocks: [...msg.blocks, { type: 'subagent', agentId, task, status: 'running' }],
  };
}

export function completeSubagent(msg: DisplayMessage, agentId: string, summary: string): DisplayMessage {
  const blocks = msg.blocks.map((block) =>
    block.type === 'subagent' && block.agentId === agentId
      ? { ...block, status: 'completed' as const, summary }
      : block,
  );
  return { ...msg, blocks };
}

function isSubagentToolName(name: string | undefined): boolean {
  return name === 'subagent_spawn' || name === 'spawn_subagent';
}

function isRedactedThinking(thinking: string): boolean {
  return thinking.includes('__REDACTED__') || thinking.startsWith('[REDACTED]');
}


export function toSubagentBlockStatus(status: DisplayToolCall['status']) {
  if (status === 'pending_approval') return 'pending' as const;
  return status;
}

function getSubagentTask(args: Record<string, unknown>): string {
  const task = args.task;
  return typeof task === 'string' && task.trim().length > 0 ? task : 'Subagent task';
}
