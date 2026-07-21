import type { ToolResult } from '@svton/agent-core';
import type { ContentBlock, DisplayToolCall } from '../types';

const FILE_CHANGE_TOOL_NAMES = new Set([
  'file_write',
  'file_edit',
  'write_file',
  'edit_file',
  'apply_diff',
]);

export function readFileChangeBlock(
  toolName: string,
  result: ToolResult,
  call?: DisplayToolCall,
): ContentBlock | null {
  if (!FILE_CHANGE_TOOL_NAMES.has(toolName) || result.isError || !call) return null;

  const path = readFileChangePath(call);
  if (!path) return null;

  return {
    type: 'file_change',
    changes: [{
      path,
      changeType: readFileChangeType(toolName),
      diff: result.output,
    }],
  };
}

function readFileChangePath(call: DisplayToolCall): string | null {
  const args = isRecord(call.arguments) ? call.arguments : {};
  const path = typeof args.path === 'string'
    ? args.path
    : typeof args.file_path === 'string' ? args.file_path : '';
  return path.length > 0 ? path : null;
}

function readFileChangeType(toolName: string): 'create' | 'modify' {
  return toolName.includes('write') || toolName.includes('create') ? 'create' : 'modify';
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}
