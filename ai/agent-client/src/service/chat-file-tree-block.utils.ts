import type { ToolResult } from '@svton/agent-core';
import type { ContentBlock, FileTreeNode } from '../types';

const LIST_TOOL_NAMES = new Set(['list_files', 'list_dir', 'ls', 'glob']);

export function readFileTreeBlock(toolName: string, result: ToolResult): ContentBlock | null {
  if (!LIST_TOOL_NAMES.has(toolName) || result.isError) return null;

  const tree = readFileTreeNodesFromOutput(toolName, result);
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
