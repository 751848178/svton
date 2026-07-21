import type { ToolCall } from '../tool/types';

interface ProviderToolCallEndEvent {
  id: string;
  name: string;
  arguments: string;
}

interface ToolCallBuffer {
  name: string;
  args: string;
}

export function readProviderToolCall(
  event: ProviderToolCallEndEvent,
  buffer?: ToolCallBuffer,
): ToolCall {
  return {
    id: event.id,
    name: resolveToolName(buffer?.name, event.name),
    arguments: parseToolArguments(buffer?.args || undefined, event.arguments),
  };
}

function resolveToolName(bufferedName: string | undefined, finalName: string): string {
  const normalizedFinalName = normalizeProviderToolName(finalName);
  const normalizedBufferedName = bufferedName === undefined
    ? undefined
    : normalizeProviderToolName(bufferedName);
  return normalizedFinalName || normalizedBufferedName || '';
}

export function normalizeProviderToolName(name: string): string {
  return name.trim();
}

function parseToolArguments(...candidates: Array<string | undefined>): Record<string, unknown> {
  let fallbackRaw = '{}';
  let emptyObject: Record<string, unknown> | null = null;
  let emptyObjectIndex = -1;

  for (const [index, candidate] of candidates.entries()) {
    if (candidate === undefined) continue;
    const raw = candidate || '{}';
    fallbackRaw = raw;
    try {
      const parsed = JSON.parse(raw);
      if (isRecord(parsed)) {
        if (Object.keys(parsed).length > 0) return parsed;
        emptyObject = parsed;
        emptyObjectIndex = index;
      }
    } catch {
      continue;
    }
  }

  if (emptyObject && emptyObjectIndex === lastDefinedIndex(candidates)) return emptyObject;
  return { raw: fallbackRaw };
}

function lastDefinedIndex(values: Array<string | undefined>): number {
  for (let index = values.length - 1; index >= 0; index -= 1) {
    if (values[index] !== undefined) return index;
  }
  return -1;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}
