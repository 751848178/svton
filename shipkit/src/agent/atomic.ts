// Atomic file writes with unique temp names (F05: concurrent writers must not collide on a fixed .tmp).

import { mkdir, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';

export async function writeFileAtomic(file: string, data: string, mode?: number): Promise<void> {
  await mkdir(path.dirname(file), { recursive: true });
  const tmp = `${file}.${process.pid}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.tmp`;
  await writeFile(tmp, data, mode !== undefined ? { mode } : undefined);
  await rename(tmp, file);
}
