import type { ToolResult } from '@svton/agent-core';
import { readStringArg } from './chat-tool-result-args.utils';
import { appendToolResultBlocksOnce } from './chat-tool-result-idempotency.utils';
import { readStructuredToolResultBlocks } from './chat-tool-result-structured-blocks.utils';
import type {
  ContentBlock,
  DisplayMessage,
  DisplayToolCall,
  PlanProgress,
  SearchResultEntry,
} from './types';

export function appendToolResultMetadataBlocks(
  msg: DisplayMessage,
  call: DisplayToolCall | undefined,
  result: ToolResult,
): DisplayMessage {
  if (!call) return msg;
  if (result.isError) {
    const errorMetadataBlocks = readStructuredToolResultBlocks(call, result)
      .filter((block) => block.type === 'auto_review');
    return errorMetadataBlocks.length > 0
      ? { ...msg, blocks: appendToolResultBlocksOnce(msg.blocks, result.callId, errorMetadataBlocks) }
      : msg;
  }

  const metadataBlocks = [
    readFileChangeBlock(call, result),
    readReferenceBlock(call),
    readWebSearchBlock(call, result),
    ...readStructuredToolResultBlocks(call, result),
  ].filter((block): block is ContentBlock => block !== null);

  if (metadataBlocks.length === 0) return msg;
  return { ...msg, blocks: appendToolResultBlocksOnce(msg.blocks, result.callId, metadataBlocks) };
}

export function readPlanProgress(result: ToolResult): PlanProgress | null {
  if (result.isError) return null;
  const progress = result.metadata?.planProgress as Partial<PlanProgress> | undefined;
  if (!progress?.planId || !Array.isArray(progress.steps)) return null;
  return {
    planId: progress.planId,
    title: progress.title ?? '',
    steps: progress.steps,
  };
}

function readReferenceBlock(call: DisplayToolCall): ContentBlock | null {
  if (!isReadToolName(call.name)) return null;
  const path = readStringArg(call.arguments, 'path') ?? readStringArg(call.arguments, 'file_path');
  return path ? { type: 'reference', refs: [{ path }] } : null;
}

function readFileChangeBlock(call: DisplayToolCall, result: ToolResult): ContentBlock | null {
  if (!isFileChangeToolName(call.name)) return null;
  const path = readStringArg(call.arguments, 'path') ?? readStringArg(call.arguments, 'file_path');
  if (!path) return null;

  return {
    type: 'file_change',
    changes: [{
      path,
      changeType: readFileChangeType(call.name),
      diff: result.output,
    }],
  };
}

function readWebSearchBlock(call: DisplayToolCall, result: ToolResult): ContentBlock | null {
  if (call.name !== 'web_search') {
    return null;
  }

  const results = readSearchResults(result.metadata?.searchResults);
  if (results.length === 0) return null;
  const query = typeof result.metadata?.query === 'string'
    ? result.metadata.query
    : readStringArg(call.arguments, 'query') ?? '';
  return { type: 'web_search', query, results };
}

function readSearchResults(value: unknown): SearchResultEntry[] {
  if (Array.isArray(value)) return value.map(normalizeSearchResult);
  if (value && typeof value === 'object') return [normalizeSearchResult(value)];
  return [];
}

function normalizeSearchResult(result: unknown): SearchResultEntry {
  const record = result && typeof result === 'object' ? result as Record<string, unknown> : {};
  return {
    title: typeof record.title === 'string' ? record.title : '',
    url: typeof record.url === 'string' ? record.url : '',
    snippet: typeof record.snippet === 'string' ? record.snippet : undefined,
  };
}

function isReadToolName(name: string): boolean {
  return name === 'file_read' || name === 'read' || name === 'read_file';
}

function isFileChangeToolName(name: string): boolean {
  return name === 'file_write' ||
    name === 'file_edit' ||
    name === 'write_file' ||
    name === 'edit_file' ||
    name === 'apply_diff';
}

function readFileChangeType(toolName: string): 'create' | 'modify' {
  return toolName.includes('write') || toolName.includes('create') ? 'create' : 'modify';
}
