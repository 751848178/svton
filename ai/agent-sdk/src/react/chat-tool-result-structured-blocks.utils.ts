import type { ToolResult } from '@svton/agent-core';
import { readCodeReviewBlock } from './chat-code-review-block.utils';
import { readCsvFanoutBlock } from './chat-csv-fanout-block.utils';
import { readStringArg } from './chat-tool-result-args.utils';
import { readPreviewImagesBlock } from './chat-preview-images-block.utils';
import type {
  ContentBlock,
  DisplayToolCall,
  FileTreeNode,
  GeneratedImage,
} from './types';

const SCREENSHOT_TOOL_NAMES = new Set(['screenshot', 'chrome_screenshot']);

export function readStructuredToolResultBlocks(call: DisplayToolCall, result: ToolResult): ContentBlock[] {
  return [
    readFileTreeBlock(call, result),
    readImageGeneratedBlock(call, result),
    readPreviewImagesBlock(call, result),
    readCodeReviewBlock(call, result),
    call.name === 'csv_fanout' ? readCsvFanoutBlock(result) : null,
    readAutoReviewBlock(call, result),
  ].filter((block): block is ContentBlock => block !== null);
}

function readFileTreeBlock(call: DisplayToolCall, result: ToolResult): ContentBlock | null {
  if (!isListToolName(call.name)) return null;

  const tree = readFileTreeNodesFromOutput(call.name, result);
  return tree.length > 0 ? { type: 'file_tree', tree } : null;
}

function readFileTreeNodesFromOutput(toolName: string, result: ToolResult): FileTreeNode[] {
  try {
    return readFileTreeNodes(JSON.parse(result.output));
  } catch {
    return toolName === 'glob' ? readGlobFileTreeNodes(result) : [];
  }
}

function readGlobFileTreeNodes(result: ToolResult): FileTreeNode[] {
  const fileCount = typeof result.metadata?.fileCount === 'number' ? result.metadata.fileCount : undefined;
  if (fileCount !== undefined && fileCount <= 0) return [];
  if (!result.output.includes('\n') && fileCount === undefined) return [];
  return result.output.split(/\r?\n/).map(line => line.trim()).filter(Boolean).map(readFileTreeNode);
}

function readFileTreeNodes(value: unknown): FileTreeNode[] {
  if (!Array.isArray(value)) return [];
  return value.map(readFileTreeNode);
}

function readFileTreeNode(item: unknown): FileTreeNode {
  if (typeof item === 'string') return { name: readPathBaseName(item), type: 'file' };
  const record = item && typeof item === 'object' ? item as Record<string, unknown> : {};
  const children = readFileTreeNodes(record.children);
  return {
    name: readFileTreeName(record),
    type: readFileTreeType(record),
    children: children.length > 0 ? children : undefined,
  };
}

function readImageGeneratedBlock(call: DisplayToolCall, result: ToolResult): ContentBlock | null {
  const parsed = readOutputRecord(result.output);
  if (SCREENSHOT_TOOL_NAMES.has(call.name)) {
    return readScreenshotImageBlock(call.name, parsed);
  }
  if (call.name !== 'image_generate') return null;

  const sourceRecord = readGeneratedImageSources(result.metadata).length > 0 ? result.metadata : parsed;
  const images = readGeneratedImageSources(sourceRecord).map(normalizeGeneratedImage).filter(hasUsableImage);
  if (images.length === 0) return null;
  return { type: 'image_generated', images, model: readImageModel(call, result.metadata, parsed) };
}

function readScreenshotImageBlock(toolName: string, parsed: Record<string, unknown> | undefined): ContentBlock | null {
  if (parsed?.type !== 'image' || typeof parsed.data !== 'string' || parsed.data.length === 0) return null;
  return {
    type: 'image_generated',
    images: [{
      url: undefined,
      base64: parsed.data,
      mimeType: typeof parsed.mimeType === 'string' ? parsed.mimeType : undefined,
      revisedPrompt: undefined,
    }],
    model: toolName,
  };
}

function readOutputRecord(output: string): Record<string, unknown> | undefined {
  try {
    const parsed = JSON.parse(output);
    return parsed && typeof parsed === 'object' ? parsed as Record<string, unknown> : undefined;
  } catch {
    return undefined;
  }
}

function readGeneratedImageSources(record: unknown): unknown[] {
  if (!record || typeof record !== 'object') return [];
  const value = record as Record<string, unknown>;
  if (Array.isArray(value.images)) return value.images;
  if (value.images && typeof value.images === 'object') return [value.images];
  return value.image && typeof value.image === 'object' ? [value.image] : [];
}

function readAutoReviewBlock(call: DisplayToolCall, result: ToolResult): ContentBlock | null {
  const verdict = result.metadata?.autoReviewVerdict;
  if (!verdict || typeof verdict !== 'object') return null;
  const record = verdict as Record<string, unknown>;
  return {
    type: 'auto_review',
    toolName: call.name,
    verdict: readAutoReviewVerdict(record.verdict),
    reason: typeof record.reason === 'string' ? record.reason : '',
    ruleId: typeof record.ruleId === 'string' ? record.ruleId : undefined,
  };
}

function normalizeGeneratedImage(image: unknown): GeneratedImage {
  const record = image && typeof image === 'object' ? image as Record<string, unknown> : {};
  return {
    url: typeof record.url === 'string' ? record.url : undefined,
    base64: typeof record.base64 === 'string' ? record.base64 : undefined,
    mimeType: typeof record.mimeType === 'string' ? record.mimeType : undefined,
    revisedPrompt: typeof record.revisedPrompt === 'string'
      ? record.revisedPrompt
      : typeof record.revised_prompt === 'string' ? record.revised_prompt : undefined,
  };
}

function hasUsableImage(image: GeneratedImage): boolean {
  return Boolean(image.url || image.base64);
}

function readImageModel(
  call: DisplayToolCall,
  metadata: Record<string, unknown> | undefined,
  parsed: Record<string, unknown> | undefined,
): string {
  if (typeof metadata?.model === 'string') return metadata.model;
  if (typeof parsed?.model === 'string') return parsed.model;
  return readStringArg(call.arguments, 'model') ?? 'unknown';
}

function isListToolName(name: string): boolean {
  return name === 'list_files' || name === 'list_dir' || name === 'ls' || name === 'glob';
}

function readFileTreeName(record: Record<string, unknown>): string {
  if (typeof record.name === 'string' && record.name.length > 0) return record.name;
  if (typeof record.path === 'string') return readPathBaseName(record.path);
  return 'unknown';
}

function readPathBaseName(path: string): string {
  return path.split(/[\\/]/).filter(Boolean).pop() || 'unknown';
}

function readFileTreeType(record: Record<string, unknown>): 'file' | 'dir' {
  return record.isDirectory || record.type === 'dir' || record.type === 'directory' ? 'dir' : 'file';
}

function readAutoReviewVerdict(value: unknown): 'approve' | 'deny' | 'ask_user' {
  return value === 'deny' || value === 'ask_user' ? value : 'approve';
}
