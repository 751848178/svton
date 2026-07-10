import React, { useState } from 'react';
import { cn } from '@svton/ui';

export interface FileTreeNode {
  name: string;
  type: 'file' | 'dir';
  children?: FileTreeNode[];
}

interface FileTreeBlockViewProps {
  tree: FileTreeNode[];
  className?: string;
}

function TreeItem({ node, depth }: { node: FileTreeNode; depth: number }) {
  const [expanded, setExpanded] = useState(depth < 1);
  const isDir = node.type === 'dir';

  return (
    <div>
      <button
        onClick={() => isDir && setExpanded(!expanded)}
        className={cn(
          'flex items-center gap-1 text-[11px] py-0.5 hover:bg-[#2a2a2a] rounded px-1 w-full text-left transition-colors',
          !isDir && 'cursor-default',
        )}
        style={{ paddingLeft: `${depth * 12 + 4}px` }}
      >
        {isDir ? (
          <>
            <span className="text-gray-500 text-[8px] flex-shrink-0">{expanded ? '▾' : '▸'}</span>
            <span className="flex-shrink-0">{expanded ? '📂' : '📁'}</span>
          </>
        ) : (
          <span className="flex-shrink-0 ml-[14px]">📄</span>
        )}
        <span className={cn('truncate', isDir ? 'text-gray-300' : 'text-gray-400')}>
          {node.name}
        </span>
      </button>
      {isDir && expanded && node.children && (
        <div>
          {node.children.map((child, i) => (
            <TreeItem key={i} node={child} depth={depth + 1} />
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * Inline file tree block — renders hierarchical directory structures.
 */
export const FileTreeBlockView: React.FC<FileTreeBlockViewProps> = ({ tree, className }) => {
  if (!tree.length) return null;

  return (
    <div className={cn('rounded-lg border border-[#383838] bg-[#2a2a2a] overflow-hidden my-1', className)}>
      <div className="px-3 py-1.5 border-b border-[#3a3a3a]">
        <span className="text-[11px] text-gray-500">📁 目录结构</span>
      </div>
      <div className="py-1 max-h-60 overflow-y-auto">
        {tree.map((node, i) => (
          <TreeItem key={i} node={node} depth={0} />
        ))}
      </div>
    </div>
  );
};
