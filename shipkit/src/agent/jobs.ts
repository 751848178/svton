// Persistent bounded job scheduling, observation, and cooperative cancellation.
import { randomUUID } from 'node:crypto';
import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import type { AgentRole, Job, JobType } from '../shared/types.js';
import { isTerminalJob } from '../shared/job-protocol.js';
import { writeFileAtomic } from './atomic.js';
import { JobJournal } from './job-journal.js';
import { jobControl, JobCancelled, type JobControl } from './job-control.js';
import { HttpFail } from './http-fail.js';
import { JobOperations, type JobOperationIdentity, type JobOperationMetadata } from './job-operations.js';
import { canReadJob } from './job-role.js';
export interface JobContext extends JobControl { log(line: string): void }
export type JobRunner = (ctx: JobContext) => Promise<unknown>;
const MAX_CONCURRENT = Math.max(1, Number(process.env.SHIP_AGENT_MAX_JOBS ?? 2) || 2);
export class JobStore {
  private readonly jobs = new Map<string, Job>();
  private readonly journals = new Map<string, JobJournal>();
  private readonly writes = new Map<string, Promise<void>>();
  private readonly waiting: Array<() => void> = [];
  private active = 0;
  private readonly operations = new JobOperations();
  constructor(private readonly workRoot: string) {}
  private dir(id: string): string { return path.join(this.workRoot, 'jobs', id); }
  private journal(id: string): JobJournal {
    let journal = this.journals.get(id);
    if (!journal) { journal = new JobJournal(this.dir(id)); this.journals.set(id, journal); }
    return journal;
  }
  async loadPersisted(): Promise<void> {
    const ids = await readdir(path.join(this.workRoot, 'jobs')).catch(() => [] as string[]);
    for (const id of ids) {
      const job = await readFile(path.join(this.dir(id), 'job.json'), 'utf8')
        .then((text) => JSON.parse(text) as Job).catch(() => null);
      if (!job?.id || job.id !== id) continue;
      this.operations.restore(job);
      this.jobs.set(id, job);
      await this.journal(id).load();
      if (!isTerminalJob(job.status)) {
        job.status = 'failed';
        job.cancellable = false;
        job.error = 'agent restarted while job was in flight; runtime state requires reconciliation';
        job.updatedAt = new Date().toISOString();
        this.journal(id).event({ phase: job.phase ?? 'queued', event: 'interrupted', detail: job.error });
        await this.flush(id);
        await this.persist(job);
      }
    }
  }
  async create(type: JobType, run: JobRunner, cancellable = false, metadata?: JobOperationMetadata): Promise<Job> {
    return this.operations.create(type, metadata, (identity) => this.createJob(type, run, cancellable, identity));
  }
  private async createJob(type: JobType, run: JobRunner, cancellable: boolean, identity: JobOperationIdentity): Promise<Job> {
    const now = new Date().toISOString();
    const job: Job = { id: randomUUID(), type, status: 'queued', createdAt: now, updatedAt: now, phase: 'queued', cancellable, ...identity };
    this.jobs.set(job.id, job);
    this.journal(job.id).event({ phase: 'queued', event: 'created' });
    await this.persist(job);
    await this.journal(job.id).flush();
    const start = () => { this.active++; void this.runJob(job, run); };
    if (this.active < MAX_CONCURRENT) start(); else this.waiting.push(start);
    return job;
  }
  private async runJob(job: Job, run: JobRunner): Promise<void> {
    const journal = this.journal(job.id);
    const ctx: JobContext = {
      log: (line) => journal.log(line),
      ...jobControl(job, (event) => {
        journal.event(event);
        void this.persist(job).catch(() => {});
      }),
    };
    try {
      ctx.checkpoint();
      job.status = 'running';
      job.updatedAt = new Date().toISOString();
      await this.persist(job);
      job.result = await run(ctx);
      await journal.flush();
      if (job.cancellable) ctx.checkpoint();
      job.status = 'succeeded';
    } catch (error) {
      const recovery = (error as { recovery?: unknown }).recovery;
      if (recovery) job.result = { recovery };
      job.status = error instanceof JobCancelled ? 'cancelled' : 'failed';
      job.error = error instanceof Error ? error.message : String(error);
      if (job.cancellation) {
        job.cancellation.outcome = job.status === 'cancelled' ? 'cancelled'
          : (recovery as { succeeded?: boolean } | undefined)?.succeeded === false ? 'recovery-failed' : 'requested';
      }
      journal.log(`job ${job.status}: ${job.error}`);
    }
    job.cancellable = false;
    job.updatedAt = new Date().toISOString();
    journal.event({ phase: job.phase ?? 'complete', event: job.status });
    try { await journal.flush(); await this.persist(job); }
    catch (error) { job.status = 'failed'; job.error = `job journal persistence failed: ${String(error)}`; console.error(job.error); }
    finally { this.active--; this.waiting.shift()?.(); }
  }
  async cancel(id: string, reason?: string): Promise<Job> {
    const job = this.get(id);
    if (!job) throw new HttpFail(404, 'job_not_found', 'job does not exist');
    if (isTerminalJob(job.status) || job.cancellation) return job;
    if (!job.cancellable) throw new HttpFail(409, 'job_not_cancellable', `job cannot be cancelled in phase ${job.phase ?? 'unknown'}`);
    job.cancellation = { requestedAt: new Date().toISOString(), ...(reason ? { reason } : {}), outcome: 'requested' };
    job.status = 'cancel-requested';
    job.updatedAt = job.cancellation.requestedAt;
    this.journal(id).event({ phase: job.phase ?? 'queued', event: 'cancel-requested', ...(reason ? { detail: reason } : {}) });
    await this.persist(job);
    await this.journal(id).flush();
    return job;
  }
  get(id: string): Job | null { return this.jobs.get(id) ?? null; }
  list(operationPrefix?: string, role?: AgentRole): Job[] {
    const jobs = [...this.jobs.values()].filter((job) => (!operationPrefix || job.operationId?.startsWith(operationPrefix)) && (!role || canReadJob(job, role)))
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    return operationPrefix ? jobs : jobs.slice(0, 100);
  }
  activeCount(): number { return this.active; }
  async flush(id: string): Promise<void> { await this.journal(id).flush(); await this.writes.get(id); }
  readLog(id: string, tailLines = 200): Promise<string | null> { return this.journal(id).tail(tailLines); }
  logPage(id: string, offset: number, limit: number) {
    return this.journal(id).readLog(offset, limit, isTerminalJob(this.get(id)!.status));
  }
  events(id: string, after: number) { return this.journal(id).readEvents(after, isTerminalJob(this.get(id)!.status)); }
  private persist(job: Job): Promise<void> {
    const data = JSON.stringify(job, null, 2);
    const pending = (this.writes.get(job.id) ?? Promise.resolve()).catch(() => {})
      .then(() => writeFileAtomic(path.join(this.dir(job.id), 'job.json'), data));
    this.writes.set(job.id, pending);
    return pending;
  }
}
