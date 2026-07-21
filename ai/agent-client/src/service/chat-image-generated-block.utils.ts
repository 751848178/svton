import type { ToolResult } from '@svton/agent-core';
import type { ContentBlock, DisplayToolCall } from '../types';

const SCREENSHOT_TOOL_NAMES = new Set(['screenshot', 'chrome_screenshot']);

export function readImageGeneratedBlock(toolName: string, result: ToolResult, call?: DisplayToolCall): ContentBlock | null {
  if (result.isError) return null;
  const parsed = readOutputRecord(result.output);

  if (SCREENSHOT_TOOL_NAMES.has(toolName)) {
    return readScreenshotImageBlock(toolName, parsed);
  }
  if (toolName !== 'image_generate') return null;

  const sourceRecord = readImageSources(result.metadata).length > 0 ? result.metadata : parsed;
  const images = readImageSources(sourceRecord).map(normalizeGeneratedImage).filter(hasUsableImage);
  if (images.length === 0) return null;
  return {
    type: 'image_generated',
    images,
    model: readImageModel(result.metadata, parsed, call),
  };
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

function readImageSources(record: unknown): unknown[] {
  if (!record || typeof record !== 'object') return [];
  const value = record as Record<string, unknown>;
  if (Array.isArray(value.images)) return value.images;
  if (value.images && typeof value.images === 'object') return [value.images];
  return value.image && typeof value.image === 'object' ? [value.image] : [];
}

function normalizeGeneratedImage(value: unknown): { url?: string; base64?: string; mimeType?: string; revisedPrompt?: string } {
  const record = value && typeof value === 'object' ? value as Record<string, unknown> : {};
  return {
    url: typeof record.url === 'string' ? record.url : undefined,
    base64: typeof record.base64 === 'string' ? record.base64 : undefined,
    mimeType: typeof record.mimeType === 'string' ? record.mimeType : undefined,
    revisedPrompt: typeof record.revisedPrompt === 'string'
      ? record.revisedPrompt
      : typeof record.revised_prompt === 'string' ? record.revised_prompt : undefined,
  };
}

function hasUsableImage(image: { url?: string; base64?: string }): boolean {
  return Boolean(image.url || image.base64);
}

function readImageModel(
  metadata: Record<string, unknown> | undefined,
  parsed: Record<string, unknown> | undefined,
  call?: DisplayToolCall,
): string {
  if (typeof metadata?.model === 'string') return metadata.model;
  if (typeof parsed?.model === 'string') return parsed.model;
  const model = call?.arguments && typeof call.arguments === 'object'
    ? (call.arguments as Record<string, unknown>).model
    : undefined;
  return typeof model === 'string' ? model : 'unknown';
}
