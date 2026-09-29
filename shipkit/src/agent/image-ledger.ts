// Managed-image ledger (RA08): every image that ever entered a release is recorded here,
// independent of the 20-entry history cap. GC candidates come from this ledger;
// entries leave it only after confirmed removal or verified absence.

import { randomUUID } from 'node:crypto';
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';

export interface LedgerEntry {
  imageRef: string;
  app: string;
  addedAt: string;
}

export class ImageLedger {
  constructor(private readonly file: string) {}

  async entries(): Promise<LedgerEntry[]> {
    let text: string;
    try {
      text = await readFile(this.file, 'utf8');
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code === 'ENOENT') return [];
      throw new Error(`image ledger unreadable: ${(e as Error).message} — GC blocked (fix or delete ${path.basename(this.file)})`);
    }
    try {
      const list = JSON.parse(text) as LedgerEntry[];
      if (!Array.isArray(list)) throw new Error('not an array');
      return list;
    } catch (e) {
      throw new Error(`image ledger corrupt (${e instanceof Error ? e.message : String(e)}) — GC blocked; archive ${path.basename(this.file)} to reset`);
    }
  }

  /** deploys append best-effort; a corrupt ledger is archived and restarted (safe direction: unknown images are never GC candidates) */
  async record(imageRef: string, app: string): Promise<void> {
    let list: LedgerEntry[] = [];
    try {
      list = await this.entries();
    } catch {
      await rename(this.file, `${this.file}.corrupt-${Date.now()}-${randomUUID().slice(0, 6)}`).catch(() => {});
      list = [];
    }
    if (list.some((e) => e.imageRef === imageRef)) return;
    list.push({ imageRef, app, addedAt: new Date().toISOString() });
    await this.write(list);
  }

  async remove(imageRef: string): Promise<void> {
    const list = await this.entries();
    const next = list.filter((e) => e.imageRef !== imageRef);
    if (next.length !== list.length) await this.write(next);
  }

  private async write(list: LedgerEntry[]): Promise<void> {
    await mkdir(path.dirname(this.file), { recursive: true });
    const tmp = `${this.file}.${randomUUID().slice(0, 8)}.tmp`;
    await writeFile(tmp, JSON.stringify(list, null, 2), { mode: 0o600 });
    await rename(tmp, this.file);
  }
}
