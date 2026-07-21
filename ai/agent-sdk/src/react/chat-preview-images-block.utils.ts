import type { ToolResult } from '@svton/agent-core';
import { readStringArg } from './chat-tool-result-args.utils';
import type { ContentBlock, DisplayToolCall } from './types';

export function readPreviewImagesBlock(call: DisplayToolCall, result: ToolResult): ContentBlock | null {
  if (call.name !== 'preview_document' || result.isError) return null;
  const previewResult = result.metadata?.previewResult;
  if (!previewResult || typeof previewResult !== 'object') return null;
  const record = previewResult as Record<string, unknown>;
  if (record.kind !== 'images') return null;

  const images = readPreviewImages(record.images);
  if (images.length === 0) return null;
  return {
    type: 'preview_images',
    images,
    title: readStringArg(call.arguments, 'path') ?? 'Document Preview',
  };
}

function readPreviewImages(value: unknown): string[] {
  if (Array.isArray(value)) return value.filter((image): image is string => typeof image === 'string');
  return typeof value === 'string' ? [value] : [];
}
