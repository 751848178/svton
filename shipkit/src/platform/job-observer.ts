import { api, ApiError } from '../shared/http.js';
import { isTerminalJob, type JobEventsPage, type JobLogPage } from '../shared/job-protocol.js';
import type { PipelineJobObservation } from '../shared/log.js';
import type { ExecutionHooks, RemoteJobRef, StageKey } from './contracts.js';
import { publicUrl } from './project-context.js';
import { EventSink } from './event-sink.js';

export class JobObserver {
  private readonly refs = new Map<string, RemoteJobRef>();
  private readonly cancelAttempts = new Set<string>();
  private readonly done = new Set<string>();
  private readonly probes = new Map<string, string>();
  currentStage: StageKey = 'provision';
  constructor(private readonly sink: EventSink, private readonly hooks: ExecutionHooks, initialRefs: RemoteJobRef[] = []) {
    for (const ref of initialRefs) this.refs.set(ref.jobId, { ...ref });
  }

  async observe(o: PipelineJobObservation): Promise<void> {
    try { await this.observeRemote(o); }
    catch (cause) {
      throw Object.assign(new Error(`Remote job observation incomplete: ${cause instanceof Error ? cause.message : String(cause)}`, { cause }),
        { archiveIncomplete: true });
    }
  }

  private async observeRemote(o: PipelineJobObservation): Promise<void> {
    this.sink.addSecret(o.handle.token);
    const [label, serviceKey] = o.label.split(':');
    const stageKey: StageKey = label === 'build' ? 'build' : label === 'push' ? 'push' : 'deploy';
    this.currentStage = stageKey;
    let ref = this.refs.get(o.jobId);
    if (!ref) {
      ref = { jobId: o.jobId, agentRole: stageKey === 'deploy' ? 'runtime' : 'builder',
        urlRef: publicUrl(o.handle.url), stageKey, serviceKey, logOffset: 0, eventOffset: 0, status: 'queued' };
      this.refs.set(o.jobId, ref);
      await this.sink.emit({ type: 'remote-job', stageKey, serviceKey, remoteJob: { ...ref } });
      await this.sink.emit({ type: 'stage', stageKey, serviceKey, status: 'running' });
    }
    if (o.job) {
      ref.status = o.job.status;
      await this.sink.emit({ type: 'cancel', status: o.job.cancellation?.outcome ?? (o.job.cancellable === false ? 'noncancellable' : 'available'),
        detail: { jobId: o.jobId, phase: o.job.phase, cancellable: o.job.cancellable } });
      await this.cancelIfRequested(o);
    }
    await this.archive(o, ref);
    await this.sink.emit({ type: 'remote-job', stageKey, serviceKey, remoteJob: { ...ref } });
    if (o.job && isTerminalJob(o.job.status) && !this.done.has(o.jobId)) {
      const result = o.job.result as { recovery?: Record<string, unknown>; verification?: string; changedServices?: string[] } | undefined;
      await this.sink.emit({ type: 'stage', stageKey, serviceKey,
        status: o.job.status === 'succeeded' ? 'succeeded' : o.job.status === 'cancelled' ? 'cancelled' : 'failed',
        detail: { error: o.job.error, result: o.job.result } });
      if (stageKey === 'deploy') {
        if (result?.verification === 'passed') {
          for (const name of result.changedServices ?? []) {
            const key = `${o.jobId}:${name}`;
            if (this.probes.get(key) !== 'running') continue;
            await this.sink.emit({ type: 'stage', stageKey: 'verify', serviceKey: name, status: 'succeeded', detail: { verification: 'passed', inferredFromOverall: true } });
            this.probes.set(key, 'succeeded');
          }
        }
        await this.sink.emit({ type: 'stage', stageKey: 'verify', status: result?.verification === 'passed' ? 'succeeded'
          : result?.verification === 'skipped' ? 'skipped' : o.job.status === 'cancelled' ? 'cancelled' : 'failed', detail: { verification: result?.verification } });
      }
      if (result?.recovery) await this.sink.emit({ type: 'recovery', status: result.recovery.succeeded ? 'succeeded' : 'failed', detail: result.recovery });
      this.done.add(o.jobId);
    }
  }

  private async cancelIfRequested(o: PipelineJobObservation): Promise<void> {
    if (!o.job || isTerminalJob(o.job.status) || this.cancelAttempts.has(o.jobId) || !await this.hooks.isCancellationRequested()) return;
    this.cancelAttempts.add(o.jobId);
    try {
      await api(o.handle.url, o.handle.token, 'POST', `/api/jobs/${o.jobId}/cancel`, { reason: 'Local platform cancellation' }, 20_000, o.handle);
      await this.sink.emit({ type: 'cancel', status: 'requested', detail: { jobId: o.jobId } });
    } catch (e) {
      if (!(e instanceof ApiError) || e.status !== 409) throw e;
      await this.sink.emit({ type: 'cancel', status: 'too-late', message: e.message, detail: { jobId: o.jobId, cancellable: false } });
    }
  }

  private async archive(o: PipelineJobObservation, ref: RemoteJobRef): Promise<void> {
    const terminal = Boolean(o.final || (o.job && isTerminalJob(o.job.status)));
    let page: JobLogPage;
    do {
      const offset = ref.logOffset ?? 0;
      page = await api<JobLogPage>(o.handle.url, o.handle.token, 'GET', `/api/jobs/${o.jobId}/log?offset=${offset}&limit=131072`, undefined, 20_000, o.handle);
      if (typeof page.text !== 'string' || !Number.isSafeInteger(page.nextOffset) || !Number.isSafeInteger(page.totalBytes)
        || page.nextOffset < offset || page.nextOffset > page.totalBytes || typeof page.complete !== 'boolean'
        || Buffer.byteLength(page.text) !== page.nextOffset - offset) throw new Error('Agent lacks complete cursor log archive protocol');
      if (page.text) await this.sink.emit({ type: 'log', stageKey: ref.stageKey, serviceKey: ref.serviceKey, message: page.text,
        detail: { jobId: ref.jobId, complete: page.complete, offset: ref.logOffset, nextOffset: page.nextOffset } });
      if (page.nextOffset === offset && page.nextOffset < page.totalBytes) throw new Error('Agent log cursor did not advance');
      ref.logOffset = page.nextOffset;
    } while (page.nextOffset < page.totalBytes);
    let events: JobEventsPage;
    do {
      const after = ref.eventOffset ?? 0;
      events = await api<JobEventsPage>(o.handle.url, o.handle.token, 'GET', `/api/jobs/${o.jobId}/events?after=${after}`, undefined, 20_000, o.handle);
      if (!Array.isArray(events.events) || !Number.isSafeInteger(events.nextSeq) || events.nextSeq < after || typeof events.complete !== 'boolean') {
        throw new Error('Agent lacks complete cursor event archive protocol');
      }
      let last = after;
      for (const event of events.events) {
        if (!Number.isSafeInteger(event.seq) || event.seq !== last + 1 || event.seq > events.nextSeq) throw new Error('Agent event cursor is inconsistent');
        last = event.seq;
      }
      if (last !== events.nextSeq || (terminal && !events.complete && last === after)) throw new Error('Agent event cursor did not advance');
      for (const event of events.events) {
        const stageKey = event.phase === 'verify' ? 'verify' : ref.stageKey;
        await this.sink.emit({ type: 'remote-event', stageKey, serviceKey: event.service ?? ref.serviceKey,
          detail: { jobId: ref.jobId, ...event } });
        if (event.phase === 'verify' && event.event === 'phase') {
          if (event.service) this.probes.set(`${o.jobId}:${event.service}`, 'running');
          await this.sink.emit({ type: 'stage', stageKey: 'verify', serviceKey: event.service, status: 'running' });
        }
        if (event.phase === 'verify' && event.event === 'probe') {
          if (!event.service || !['succeeded', 'skipped', 'failed'].includes(event.detail ?? '')) throw new Error('Agent returned an invalid probe outcome');
          await this.sink.emit({ type: 'stage', stageKey: 'verify', serviceKey: event.service, status: event.detail });
          this.probes.set(`${o.jobId}:${event.service}`, event.detail!);
        }
      }
      ref.eventOffset = events.nextSeq;
    } while (terminal && !events.complete);
    if (terminal && !page.complete) throw new Error('Terminal Agent log is not flushed; refusing to release unarchived builder');
  }
}
