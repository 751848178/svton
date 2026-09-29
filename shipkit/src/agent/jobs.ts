// Job store: bounded concurrency queue, crash-safe lifecycle, tail-by-bytes log reads (F17/F34/F04).

import { randomUUID } from 'node:crypto';
import { appendFile, mkdir, open, readFile, readdir, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import type { Job, JobType } from '../shared/types.js';

export interface JobContext {
  log(line: string): void;
}

export type JobRunner = (ctx: JobContext) => Promise<unknown>;

const MAX_CONCURRENT = Math.max(1, Number(process.env.SHIP_AGENT_MAX_JOBS ?? 2) || 2);

export class JobStore {
  private readonly jobs = new Map<string, Job>();
  private readonly waiting: Array<() => void> = [];
  private active = 0;

  constructor(private readonly workRoot: string) {}

  private dir(id: string): string {
    return path.join(this.workRoot, 'jobs', id);
  }

  /** Recover persisted jobs after an agent restart; in-flight jobs are marked failed. */
  async loadPersisted(): Promise<void> {
    const root = path.join(this.workRoot, 'jobs');
    const ids = await readdir(root).catch(() => [] as string[]);
    for (const id of ids) {
      const job = await readFile(path.join(this.dir(id), 'job.json'), 'utf8')
        .then((t) => JSON.parse(t) as Job)
        .catch(() => null);
      if (!job?.id) continue;
      if (job.status === 'running' || job.status === 'queued') {
        job.status = 'failed';
        job.error = 'agent restarted while job was in flight';
        job.updatedAt = new Date().toISOString();
        await this.persist(job);
      }
      this.jobs.set(job.id, job);
    }
    // prune job dirs older than 7 days (F34)
    const cutoff = Date.now() - 7 * 24 * 3600_000;
    for (const id of ids) {
      const p = path.join(this.dir(id));
      const mtime = (await stat(p).catch(() => null))?.mtimeMs ?? 0;
      if (mtime > 0 && mtime < cutoff) this.jobs.delete(id);
    }
  }

  create(type: JobType, run: JobRunner): Job {
    const now = new Date().toISOString();
    const job: Job = { id: randomUUID(), type, status: 'queued', createdAt: now, updatedAt: now };
    this.jobs.set(job.id, job);
    this.enqueue(job, run);
    return job;
  }

  private enqueue(job: Job, run: JobRunner): void {
    const start = () => {
      this.active++;
      job.status = 'running';
      job.updatedAt = new Date().toISOString();
      // full lifecycle catch: persistence/IO failures degrade this job, never the agent process (F17)
      void this.runJob(job, run);
    };
    if (this.active < MAX_CONCURRENT) start();
    else this.waiting.push(start);
  }

  private async runJob(job: Job, run: JobRunner): Promise<void> {
    const logFile = path.join(this.dir(job.id), 'log.txt');
    const ctx: JobContext = {
      log: (line) => {
        void appendFile(logFile, `${line}\n`).catch(() => {});
      },
    };
    try {
      await mkdir(path.dirname(logFile), { recursive: true });
      await this.persist(job);
      job.result = await run(ctx);
      job.status = 'succeeded';
    } catch (e) {
      job.status = 'failed';
      job.error = e instanceof Error ? e.message : String(e);
      const recovery = (e as { recovery?: unknown }).recovery;
      if (recovery) job.result = { recovery }; // structured recovery outcome for API consumers (F04)
      ctx.log(`job failed: ${job.error}`);
    }
    job.updatedAt = new Date().toISOString();
    await this.persist(job).catch((e: unknown) => {
      console.error(`[jobs] persist failed for ${job.id} (kept in memory):`, e instanceof Error ? e.message : e);
    });
    this.active--;
    const next = this.waiting.shift();
    if (next) next();
  }

  get(id: string): Job | null {
    return this.jobs.get(id) ?? null;
  }

  list(): Job[] {
    return [...this.jobs.values()].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 100);
  }

  activeCount(): number {
    return this.active;
  }

  /** read only the tail bytes from disk (F34) */
  async readLog(id: string, tailLines = 200): Promise<string | null> {
    const file = path.join(this.dir(id), 'log.txt');
    const size = (await stat(file).catch(() => null))?.size ?? null;
    if (size === null) return null;
    const fh = await open(file, 'r');
    try {
      const len = Math.min(size, 128 * 1024);
      const buf = Buffer.alloc(len);
      await fh.read(buf, 0, len, size - len);
      return buf.toString('utf8').split('\n').slice(-tailLines).join('\n');
    } finally {
      await fh.close();
    }
  }

  private async persist(job: Job): Promise<void> {
    const file = path.join(this.dir(job.id), 'job.json');
    await mkdir(path.dirname(file), { recursive: true });
    await writeFile(file, JSON.stringify(job, null, 2));
  }
}
