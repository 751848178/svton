import React, { useState } from 'react';
import { cn, useI18n } from '@svton/ui';
import type { ArtifactTarget } from '../../artifacts/artifact.types';

export interface FileTreeNode {
  name: string;
  type: 'file' | 'dir';
  path?: string;
  children?: FileTreeNode[];
}

interface FileTreeBlockViewProps {
  tree: FileTreeNode[];
  className?: string;
  artifactId?: string;
  onArtifactOpen?: (target: ArtifactTarget) => void;
}

function TreeItem({ node, depth, parentPath, artifactId, onArtifactOpen }: {
  node: FileTreeNode;
  depth: number;
  parentPath: string;
  artifactId?: string;
  onArtifactOpen?: (target: ArtifactTarget) => void;
}) {
  const { translate: t } = useI18n();
  const [expanded, setExpanded] = useState(depth < 1);
  const isDir = node.type === 'dir';
  const path = node.path ?? [parentPath, node.name].filter(Boolean).join('/');

  return (
    <div>
      <button
        type="button"
        onClick={() => isDir
          ? setExpanded(!expanded)
          : artifactId && onArtifactOpen?.({ kind: 'file', id: `${artifactId}:file:${path}`, path, source: 'tree' })}
        disabled={!isDir && !(artifactId && onArtifactOpen)}
        className={cn(
          'flex min-h-11 w-full items-center gap-2 rounded px-2 text-left text-[11px] transition-colors hover:bg-[#2a2a2a]',
          !isDir && !(artifactId && onArtifactOpen) && 'cursor-default',
        )}
        style={{ paddingLeft: `${depth * 12 + 4}px` }}
      >
        <span className="w-10 flex-shrink-0 text-[10px] text-gray-500">{t(isDir ? 'chat.attachment.folder' : 'chat.attachment.file')}</span>
        <span className={cn('truncate', isDir ? 'text-gray-300' : 'text-gray-400')}>
          {node.name}
        </span>
        {isDir && <span className="ml-auto text-[10px] text-gray-500">{t(expanded ? 'action.collapse' : 'action.expand')}</span>}
      </button>
      {isDir && expanded && node.children && (
        <div>
          {node.children.map((child, i) => (
            <TreeItem key={`${child.path ?? child.name}:${i}`} node={child} depth={depth + 1} parentPath={path} artifactId={artifactId} onArtifactOpen={onArtifactOpen} />
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * Inline file tree block — renders hierarchical directory structures.
 */
export const FileTreeBlockView: React.FC<FileTreeBlockViewProps> = ({ tree, className, artifactId, onArtifactOpen }) => {
  const { translate: t } = useI18n();
  if (!tree.length) return null;

  return (
    <div className={cn('rounded-lg border border-[#383838] bg-[#2a2a2a] overflow-hidden my-1', className)}>
      <div className="flex min-h-11 items-center border-b border-[#3a3a3a] px-3 py-1.5">
        <span className="text-[11px] text-gray-500">{t('block.file_tree.title')}</span>
      </div>
      <div className="py-1 max-h-60 overflow-y-auto">
        {tree.map((node, i) => (
          <TreeItem key={`${node.path ?? node.name}:${i}`} node={node} depth={0} parentPath="" artifactId={artifactId} onArtifactOpen={onArtifactOpen} />
        ))}
      </div>
    </div>
  );
};
