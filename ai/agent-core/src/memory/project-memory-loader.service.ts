import type { IFileSystem } from '@svton/agent-platform';
import type { MemoryEntry } from './types';

export async function loadProjectMemoryEntries(
  fs: IFileSystem,
  startDir: string,
  fileName: string,
): Promise<MemoryEntry[]> {
  const entries: MemoryEntry[] = [];
  let currentDir = startDir;
  const visited = new Set<string>();

  while (currentDir && !visited.has(currentDir)) {
    visited.add(currentDir);
    const filePath = fs.join(currentDir, fileName);

    try {
      const exists = await fs.exists(filePath);
      if (exists) {
        const content = await fs.readFile(filePath);
        if (content.trim()) {
          entries.push({
            key: `project:${filePath}`,
            content: content.trim(),
            scope: 'project',
            source: filePath,
            createdAt: Date.now(),
            updatedAt: Date.now(),
          });
        }
      }
    } catch {
      // File not readable, skip.
    }

    const parent = fs.dirname(currentDir);
    if (parent === currentDir) break;
    currentDir = parent;
  }

  return entries.reverse();
}
