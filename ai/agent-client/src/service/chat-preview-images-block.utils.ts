import type { ToolResult } from '@svton/agent-core';
import type { ContentBlock, DisplayToolCall } from '../types';

export function readPreviewImagesBlock(toolName: string, result: ToolResult, call?: DisplayToolCall): ContentBlock | null {
  if (toolName !== 'preview_document' || result.isError) return null;
  const previewResult = result.metadata?.previewResult;
  if (!previewResult || typeof previewResult !== 'object') return null;
  const record = previewResult as Record<string, unknown>;
  if (record.kind !== 'images') return null;

  const images = readPreviewImages(record.images);
  if (images.length === 0) return null;
  return {
    type: 'preview_images',
    images,
    title: readPreviewTitle(call),
  };
}

function readPreviewImages(value: unknown): string[] {
  if (Array.isArray(value)) return value.filter((image): image is string => typeof image === 'string');
  return typeof value === 'string' ? [value] : [];
}

function readPreviewTitle(call?: DisplayToolCall): string {
  const path = call?.arguments && typeof call.arguments === 'object'
    ? (call.arguments as Record<string, unknown>).path
    : undefined;
  return typeof path === 'string' ? path : 'Document Preview';
}
