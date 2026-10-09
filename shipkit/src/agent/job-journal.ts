// Ordered disk journal and bounded cursor reads; terminal callers await flush.
import { appendFile, mkdir, open, readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import type { JobEvent, JobEventsPage, JobLogPage } from '../shared/job-protocol.js';
export class JobJournal {
  private pending = Promise.resolve();
  private seq = 0;
  constructor(private readonly dir: string) {}
  async load(): Promise<void> {
    const data = await readFile(path.join(this.dir, 'events.jsonl'), 'utf8').catch(() => '');
    for (const line of data.split('\n').filter(Boolean)) this.seq = Math.max(this.seq, (JSON.parse(line) as JobEvent).seq);
  }
  log(line: string): void { this.append('log.txt', `${line}\n`); }
  event(event: Omit<JobEvent, 'seq' | 'ts'>): void {
    this.append('events.jsonl', `${JSON.stringify({ ...event, seq: ++this.seq, ts: new Date().toISOString() })}\n`);
  }
  private append(file: string, text: string): void {
    this.pending = this.pending.then(async () => {
      await mkdir(this.dir, { recursive: true });
      await appendFile(path.join(this.dir, file), text);
    });
    // Keep the rejection observable via flush, without an unhandled rejection.
    void this.pending.catch(() => {});
  }
  flush(): Promise<void> { return this.pending; }
  async readLog(offset: number, limit: number, complete: boolean): Promise<JobLogPage> {
    await this.flush();
    const file = path.join(this.dir, 'log.txt');
    const totalBytes = (await stat(file).catch(() => null))?.size ?? 0;
    if (offset > totalBytes) throw new Error('log offset exceeds current length');
    const size = Math.min(limit, totalBytes - offset);
    if (!size) return { text: '', nextOffset: offset, totalBytes, complete };
    const fh = await open(file, 'r');
    try {
      const bytes = Buffer.alloc(size);
      await fh.read(bytes, 0, size, offset);
      // Do not split a UTF-8 character at a page boundary.
      let end = size;
      if (offset + size < totalBytes) {
        while (end > 0 && (bytes[end - 1]! & 0xc0) === 0x80) end--;
        if (end > 0 && bytes[end - 1]! >= 0xc0) end--;
        if (end === 0) end = size;
      }
      return { text: bytes.subarray(0, end).toString('utf8'), nextOffset: offset + end, totalBytes, complete };
    } finally { await fh.close(); }
  }
  async tail(lines: number): Promise<string> {
    await this.flush();
    const file = path.join(this.dir, 'log.txt');
    const size = (await stat(file).catch(() => null))?.size ?? 0;
    const page = await this.readLog(Math.max(0, size - 128 * 1024), 128 * 1024, false);
    return page.text.split('\n').slice(-lines).join('\n');
  }
  async readEvents(after: number, complete: boolean): Promise<JobEventsPage> {
    await this.flush();
    const data = await readFile(path.join(this.dir, 'events.jsonl'), 'utf8').catch(() => '');
    const events: JobEvent[] = data.split('\n').filter(Boolean).map((line) => JSON.parse(line) as JobEvent);
    const page = events.filter((event) => event.seq > after).slice(0, 500);
    return { events: page, nextSeq: page.at(-1)?.seq ?? after, complete: complete && !events.some((event) => event.seq > (page.at(-1)?.seq ?? after)) };
  }
}
