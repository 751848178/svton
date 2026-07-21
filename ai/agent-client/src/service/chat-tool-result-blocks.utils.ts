import type { ToolResult } from '@svton/agent-core';
import type { ContentBlock, DisplayToolCall } from '../types';
import { readCodeReviewBlock } from './chat-code-review-block.utils';
import { readCsvFanoutBlock } from './chat-csv-fanout-block.utils';
import { readFileChangeBlock } from './chat-file-change-block.utils';
import { readFileTreeBlock } from './chat-file-tree-block.utils';
import { readImageGeneratedBlock } from './chat-image-generated-block.utils';
import { readPreviewImagesBlock } from './chat-preview-images-block.utils';
import { appendToolResultBlocksOnce } from './chat-tool-result-idempotency.utils';
import { readWebSearchBlock } from './chat-web-search-block.utils';

export function appendToolResultMetadataBlocks(
  blocks: ContentBlock[],
  toolName: string,
  result: ToolResult,
  call?: DisplayToolCall,
): ContentBlock[] {
  if (!call) return blocks;

  const metadataBlocks = [
    readFileChangeBlock(toolName, result, call),
    readReferenceBlock(toolName, result, call),
    readWebSearchBlock(toolName, result, call),
    readFileTreeBlock(toolName, result),
    readImageGeneratedBlock(toolName, result, call),
    toolName === 'csv_fanout' && !result.isError ? readCsvFanoutBlock(result) : null,
    readCodeReviewBlock(toolName, result),
    readAutoReviewBlock(toolName, result),
    readPreviewImagesBlock(toolName, result, call),
  ].filter((block): block is ContentBlock => block !== null);

  return appendToolResultBlocksOnce(blocks, result.callId, metadataBlocks);
}

function readReferenceBlock(
  toolName: string,
  result: ToolResult,
  call?: DisplayToolCall,
): ContentBlock | null {
  if (!call || result.isError || !isReadToolName(toolName)) return null;
  const path = call.arguments.path ?? call.arguments.file_path;
  return typeof path === 'string' && path.length > 0
    ? { type: 'reference', refs: [{ path }] }
    : null;
}

function readAutoReviewBlock(toolName: string, result: ToolResult): ContentBlock | null {
  const verdict = result.metadata?.autoReviewVerdict;
  if (!verdict || typeof verdict !== 'object') return null;

  const record = verdict as Record<string, unknown>;
  return {
    type: 'auto_review',
    toolName,
    verdict: readAutoReviewVerdict(record.verdict),
    reason: typeof record.reason === 'string' ? record.reason : '',
    ruleId: typeof record.ruleId === 'string' ? record.ruleId : undefined,
  };
}

function isReadToolName(toolName: string): boolean {
  return toolName === 'file_read' || toolName === 'read' || toolName === 'read_file';
}

function readAutoReviewVerdict(value: unknown): 'approve' | 'deny' | 'ask_user' {
  return value === 'deny' || value === 'ask_user' ? value : 'approve';
}
