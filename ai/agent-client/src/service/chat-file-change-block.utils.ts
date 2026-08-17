import type { ToolResult } from '@svton/agent-core';
import type { ContentBlock, DisplayToolCall } from '../types';
import {
  isFileChangeTool,
  readFileChangePath,
  readFileChangeType,
} from '../timeline/file-outcome-normalizer';

export function readFileChangeBlock(
  toolName: string,
  result: ToolResult,
  call?: DisplayToolCall,
): ContentBlock | null {
  if (!isFileChangeTool(toolName) || result.isError || !call) return null;

  const path = readFileChangePath(call.arguments);
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
