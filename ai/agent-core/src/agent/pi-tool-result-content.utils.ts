import type { AgentToolResult } from '@earendil-works/pi-agent-core';

export function toPiToolResultContent(
  output: string,
): AgentToolResult<unknown>['content'] {
  const image = readImageOutput(output);
  return image ? [image] : [{ type: 'text', text: output }];
}

function readImageOutput(
  output: string,
): { type: 'image'; data: string; mimeType: string } | null {
  try {
    const value = JSON.parse(output) as unknown;
    if (!isRecord(value) || value.type !== 'image') return null;
    if (typeof value.data !== 'string' || typeof value.mimeType !== 'string') {
      return null;
    }
    return { type: 'image', data: value.data, mimeType: value.mimeType };
  } catch {
    return null;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
