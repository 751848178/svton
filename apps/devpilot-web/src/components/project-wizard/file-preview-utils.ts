/** 文件预览工具函数 - 构建文件树、排序、图标。 */

export interface FileNode {
  name: string;
  path: string;
  type: 'file' | 'folder';
  content?: string;
  size?: number;
  children: FileNode[];
}

export function buildFileTree(files: { path: string; content: string; size: number }[]): FileNode {
  const root: FileNode = { name: '/', path: '/', type: 'folder', children: [] };
  for (const file of files) {
    const parts = file.path.split('/');
    let current = root;
    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];
      const isLast = i === parts.length - 1;
      const currentPath = parts.slice(0, i + 1).join('/');
      let child = current.children.find((c) => c.name === part);
      if (!child) {
        child = {
          name: part,
          path: currentPath,
          type: isLast ? 'file' : 'folder',
          children: [],
          ...(isLast ? { content: file.content, size: file.size } : {}),
        };
        current.children.push(child);
      }
      current = child;
    }
  }
  sortFileTree(root);
  return root;
}

export function sortFileTree(node: FileNode): void {
  node.children.sort((a, b) => {
    if (a.type !== b.type) return a.type === 'folder' ? -1 : 1;
    return a.name.localeCompare(b.name);
  });
  node.children.forEach((child) => {
    if (child.type === 'folder') sortFileTree(child);
  });
}

export function getFileIcon(filename: string): string {
  const ext = filename.split('.').pop()?.toLowerCase() || '';
  const icons: Record<string, string> = {
    ts: '📘',
    tsx: '📘',
    js: '📒',
    jsx: '📒',
    json: '📋',
    md: '📝',
    env: '⚙️',
    yml: '⚙️',
    yaml: '⚙️',
    sh: '🔧',
    sql: '🗄️',
    prisma: '🗄️',
    dockerfile: '🐳',
  };
  return icons[ext] || '📄';
}
