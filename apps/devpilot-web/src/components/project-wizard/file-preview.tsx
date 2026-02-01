'use client';

import { useState } from 'react';

interface FileNode {
  name: string;
  path: string;
  type: 'file' | 'folder';
  children?: FileNode[];
  content?: string;
  size?: number;
}

interface FilePreviewProps {
  files: { path: string; content: string; size: number }[];
}

export function FilePreview({ files }: FilePreviewProps) {
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set(['/']));

  // 构建文件树
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
    <div className="border rounded-lg overflow-hidden">
      <div className="flex h-[400px]">
        {/* 文件树 */}
        <div className="w-64 border-r overflow-auto bg-muted/30">
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

        {/* 文件内容 */}
        <div className="flex-1 overflow-auto">
          {selectedFile ? (
            <div className="p-4">
              <div className="flex items-center justify-between mb-2 pb-2 border-b">
                <span className="text-sm font-medium">{selectedFile}</span>
                <span className="text-xs text-muted-foreground">
                  {files.find((f) => f.path === selectedFile)?.size} bytes
                </span>
              </div>
              <pre className="text-xs font-mono whitespace-pre-wrap break-all">
                <code>{selectedContent}</code>
              </pre>
            </div>
          ) : (
            <div className="flex items-center justify-center h-full text-muted-foreground">
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
          className="flex items-center w-full px-2 py-1 text-sm hover:bg-accent rounded text-left"
          style={{ paddingLeft }}
        >
          <span className="mr-1">{isExpanded ? '📂' : '📁'}</span>
          {node.name}
        </button>
        {isExpanded && node.children && (
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
        )}
      </div>
    );
  }

  return (
    <button
      onClick={() => onSelectFile(node.path)}
      className={`flex items-center w-full px-2 py-1 text-sm rounded text-left ${
        isSelected ? 'bg-primary text-primary-foreground' : 'hover:bg-accent'
      }`}
      style={{ paddingLeft }}
    >
      <span className="mr-1">{getFileIcon(node.name)}</span>
      {node.name}
    </button>
  );
}

function buildFileTree(files: { path: string; content: string; size: number }[]): FileNode {
  const root: FileNode = {
    name: '/',
    path: '/',
    type: 'folder',
    children: [],
  };

  for (const file of files) {
    const parts = file.path.split('/');
    let current = root;

    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];
      const isLast = i === parts.length - 1;
      const currentPath = parts.slice(0, i + 1).join('/');

      if (isLast) {
        current.children = current.children || [];
        current.children.push({
          name: part,
          path: file.path,
          type: 'file',
          content: file.content,
          size: file.size,
        });
      } else {
        current.children = current.children || [];
        let folder = current.children.find((c) => c.name === part && c.type === 'folder');
        if (!folder) {
          folder = {
            name: part,
            path: currentPath,
            type: 'folder',
            children: [],
          };
          current.children.push(folder);
        }
        current = folder;
      }
    }
  }

  // 排序：文件夹在前，文件在后
  sortFileTree(root);

  return root;
}

function sortFileTree(node: FileNode) {
  if (node.children) {
    node.children.sort((a, b) => {
      if (a.type !== b.type) {
        return a.type === 'folder' ? -1 : 1;
      }
      return a.name.localeCompare(b.name);
    });
    node.children.forEach(sortFileTree);
  }
}

function getFileIcon(filename: string): string {
  const ext = filename.split('.').pop()?.toLowerCase();
  
  const icons: Record<string, string> = {
    ts: '📘',
    tsx: '📘',
    js: '📒',
    jsx: '📒',
    json: '📋',
    md: '📝',
    yml: '⚙️',
    yaml: '⚙️',
    env: '🔐',
    prisma: '💾',
    css: '🎨',
    scss: '🎨',
    html: '🌐',
  };

  return icons[ext || ''] || '📄';
}
