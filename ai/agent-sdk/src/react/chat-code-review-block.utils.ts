import type { ToolResult } from '@svton/agent-core';
import type { CodeReviewFinding, ContentBlock, DisplayToolCall } from './types';

export function readCodeReviewBlock(call: DisplayToolCall, result: ToolResult): ContentBlock | null {
  if (call.name !== 'git_diff' || !result.output) return null;
  const findings = readChangedFileFindings(result.output).slice(0, 10);
  return findings.length > 0 ? { type: 'code_review', findings } : null;
}

function readChangedFileFindings(diff: string): CodeReviewFinding[] {
  const seen = new Set<string>();
  return diff
    .split('\n')
    .filter((line) => line.startsWith('+++ ') || line.startsWith('--- '))
    .map(readChangedFilePath)
    .filter((file): file is string => {
      if (!file || seen.has(file)) return false;
      seen.add(file);
      return true;
    })
    .map((file) => ({ file, severity: 'info', comment: '文件变更' }));
}

function readChangedFilePath(line: string): string | null {
  const file = line.replace(/^(\+\+\+|---) /, '').replace(/^b\//, '').replace(/^a\//, '');
  return file === '/dev/null' ? null : file;
}
