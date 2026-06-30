'use client';

import { useState } from 'react';
import { usePersistFn } from '@svton/hooks';
import { buildFileTree, getFileIcon, type FileNode } from './file-preview-utils';

interface FilePreviewProps {
  files: { path: string; content: string; size: number }[];
}

export function FilePreview({ files }: FilePreviewProps) {
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set(['/']));

  const fileTree = buildFileTree(files);

  const toggleFolder = (path: string) => {
    setExpandedFolders((prev) => {
      const next = new Set(prev);
      if (next.has(path)) {
        next.delete(path);
      } else {
        next.add(path);
      }
      return next;
    });
  };

  const selectedContent = files.find((f) => f.path === selectedFile)?.content;

  return (
    <div className="overflow-hidden rounded-lg border">
      <div className="flex h-[400px]">
        <div className="w-64 overflow-auto border-r bg-muted/30">
          <div className="p-2">
            <FileTreeNode
              node={fileTree}
              level={0}
              selectedFile={selectedFile}
              expandedFolders={expandedFolders}
              onSelectFile={setSelectedFile}
              onToggleFolder={toggleFolder}
            />
          </div>
        </div>
        <div className="flex-1 overflow-auto">
          {selectedFile ? (
            <div className="p-4">
              <div className="mb-2 flex items-center justify-between border-b pb-2">
                <span className="text-sm font-medium">{selectedFile}</span>
                <span className="text-xs text-muted-foreground">
                  {files.find((f) => f.path === selectedFile)?.size} bytes
                </span>
              </div>
              <pre className="whitespace-pre-wrap break-all font-mono text-xs">
                <code>{selectedContent}</code>
              </pre>
            </div>
          ) : (
            <div className="flex h-full items-center justify-center text-muted-foreground">
              选择一个文件查看内容
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function FileTreeNode({
  node,
  level,
  selectedFile,
  expandedFolders,
  onSelectFile,
  onToggleFolder,
}: {
  node: FileNode;
  level: number;
  selectedFile: string | null;
  expandedFolders: Set<string>;
  onSelectFile: (path: string) => void;
  onToggleFolder: (path: string) => void;
}) {
  const isExpanded = expandedFolders.has(node.path);
  const isSelected = selectedFile === node.path;
  const paddingLeft = level * 12;

  if (node.type === 'folder') {
    return (
      <div>
        <button
          onClick={() => onToggleFolder(node.path)}
          className="flex w-full items-center rounded px-2 py-1 text-left text-sm hover:bg-accent"
          style={{ paddingLeft }}
        >
          <span className="mr-1">{isExpanded ? '📂' : '📁'}</span>
          {node.name}
        </button>
        {isExpanded && node.children ? (
          <div>
            {node.children.map((child) => (
              <FileTreeNode
                key={child.path}
                node={child}
                level={level + 1}
                selectedFile={selectedFile}
                expandedFolders={expandedFolders}
                onSelectFile={onSelectFile}
                onToggleFolder={onToggleFolder}
              />
            ))}
          </div>
        ) : null}
      </div>
    );
  }

  return (
    <button
      onClick={() => onSelectFile(node.path)}
      className={`flex w-full items-center rounded px-2 py-1 text-left text-sm ${isSelected ? 'bg-primary text-primary-foreground' : 'hover:bg-accent'}`}
      style={{ paddingLeft }}
    >
      <span className="mr-1">{getFileIcon(node.name)}</span>
      {node.name}
    </button>
  );
}
