// Atomic file writes with unique temp names (F05: concurrent writers must not collide on a fixed .tmp).

import { mkdir, rename, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';

export async function writeFileAtomic(file: string, data: string, mode?: number, beforeRename?: () => Promise<void>): Promise<void> {
  await mkdir(path.dirname(file), { recursive: true });
  const tmp = `${file}.${process.pid}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.tmp`;
  try {
    await writeFile(tmp, data, mode !== undefined ? { mode } : undefined);
    // Complete all awaited preparation before the read-only ownership gate.
    await beforeRename?.();
    await rename(tmp, file);
  } catch (e) {
    // A refusal must leave the destination and other writers' temps intact.
    await rm(tmp, { force: true }).catch(() => {});
    throw e;
  }
}
