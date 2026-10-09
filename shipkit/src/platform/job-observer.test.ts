import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import type { Job, JobEvent, JobEventsPage, JobLogPage } from '../shared/job-protocol.js';
import type { ExecutionEvent, RemoteJobRef } from './contracts.js';
import { EventSink } from './event-sink.js';
import { JobObserver } from './job-observer.js';
import { waitAndReport } from '../cli/job-report.js';
import { createLogger } from '../shared/log.js';

const terminal: Job = { id: 'deploy-1', type: 'group-deploy', status: 'succeeded', createdAt: '', updatedAt: '', result: { verification: 'passed' } };
const entry = (seq: number): JobEvent => ({ seq, ts: 'test', phase: 'prepare', event: 'phase' });
const emptyLog: JobLogPage = { text: '', nextOffset: 0, totalBytes: 0, complete: true };
const marked = (e: unknown) => e instanceof Error && (e as Error & { archiveIncomplete?: boolean }).archiveIncomplete === true;

async function fixture(page: (after: number) => JobEventsPage, options: {
  log?: JobLogPage;
  emit?: (event: ExecutionEvent) => Promise<void>;
  initial?: RemoteJobRef[];
} = {}) {
  const afters: number[] = [];
  const records: ExecutionEvent[] = [];
  const server = createServer((req, res) => {
    const url = new URL(req.url!, 'http://localhost');
    res.writeHead(200, { 'content-type': 'application/json' });
    if (url.pathname === `/api/jobs/${terminal.id}`) return res.end(JSON.stringify(terminal));
    if (url.pathname.endsWith('/log')) return res.end(JSON.stringify(options.log ?? emptyLog));
    const after = Number(url.searchParams.get('after'));
    afters.push(after);
    res.end(JSON.stringify(page(after)));
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const handle = { url: `http://127.0.0.1:${(server.address() as AddressInfo).port}`, token: 'test-master' };
  const hooks = { emit: async (event: ExecutionEvent) => { await options.emit?.(event); records.push(event); }, isCancellationRequested: async () => false };
  const observer = new JobObserver(new EventSink(hooks, []), hooks, options.initial);
  return { observer, records, afters, handle,
    observation: { handle, jobId: terminal.id, label: 'deploy', job: terminal },
    close: () => new Promise<void>((resolve, reject) => server.close((e) => e ? reject(e) : resolve())) };
}

test('terminal polling archives every event page before durable completion; restart resumes exact cursor', async (t) => {
  const all = Array.from({ length: 1205 }, (_, i) => entry(i + 1));
  const fx = await fixture((after) => {
    const events = all.filter((event) => event.seq > after).slice(0, 500);
    const nextSeq = events.at(-1)?.seq ?? after;
    return { events, nextSeq, complete: nextSeq === all.length };
  });
  t.after(fx.close);
  // waitAndReport's terminal onPoll does not set final: it must still drain all pages.
  await fx.observer.observe(fx.observation);
  assert.deepEqual(fx.afters, [0, 500, 1000]);
  const archived = fx.records.filter((event) => event.type === 'remote-event');
  assert.deepEqual(archived.map((event) => event.detail?.seq), all.map((event) => event.seq));
  const lastRef = fx.records.filter((event) => event.type === 'remote-job').at(-1)?.remoteJob!;
  assert.equal(lastRef.eventOffset, 1205);
  assert.ok(fx.records.findIndex((event) => event.type === 'stage' && event.status === 'succeeded') > fx.records.lastIndexOf(archived.at(-1)!));
  await fx.observer.observe({ ...fx.observation, final: true });
  assert.equal(fx.records.filter((event) => event.type === 'remote-event').length, 1205);
  const resumed = await fixture((after) => ({ events: all.filter((event) => event.seq > after), nextSeq: 1205, complete: true }), { initial: [lastRef] });
  t.after(resumed.close);
  await resumed.observer.observe(resumed.observation);
  assert.deepEqual(resumed.afters, [1205]);
  assert.equal(resumed.records.filter((event) => event.type === 'remote-event').length, 0);
});

test('stalled terminal event cursor fails without reporting durable terminal completion', async (t) => {
  const fx = await fixture((after) => ({ events: [], nextSeq: after, complete: false }));
  t.after(fx.close);
  await assert.rejects(fx.observer.observe(fx.observation), (e: unknown) => marked(e) && /did not advance/.test((e as Error).message));
  assert.deepEqual(fx.afters, [0]);
  assert.ok(!fx.records.some((event) => event.type === 'stage' && event.status === 'succeeded'));
});

test('active jobs at event EOF consume one page and wait for the next poll', async (t) => {
  const fx = await fixture((after) => ({ events: [], nextSeq: after, complete: false }));
  t.after(fx.close);
  await fx.observer.observe({ ...fx.observation, job: { ...terminal, status: 'running' } });
  assert.deepEqual(fx.afters, [0]);
});

test('stalled later event page preserves archived records but refuses completion', async (t) => {
  const fx = await fixture((after) => after === 0 ? { events: [entry(1)], nextSeq: 1, complete: false }
    : { events: [], nextSeq: after, complete: false });
  t.after(fx.close);
  await assert.rejects(fx.observer.observe({ ...fx.observation, job: undefined, final: true }), marked);
  assert.deepEqual(fx.afters, [0, 1]);
  assert.equal(fx.records.filter((event) => event.type === 'remote-event').length, 1);
  assert.equal(fx.records.filter((event) => event.type === 'remote-job').length, 1);
});

for (const invalid of [
  { events: [], nextSeq: -1, complete: true },
  { events: [entry(2), entry(1)], nextSeq: 2, complete: true },
  { events: [entry(1)], nextSeq: 2, complete: true },
  { events: [entry(2)], nextSeq: 2, complete: true },
]) {
  test(`invalid event cursor ${JSON.stringify(invalid)} fails with archive retention marker`, async (t) => {
    const fx = await fixture(() => invalid);
    t.after(fx.close);
    await assert.rejects(fx.observer.observe(fx.observation), marked);
  });
}

test('terminal log must be flushed even when observed by terminal onPoll', async (t) => {
  const fx = await fixture(() => ({ events: [], nextSeq: 0, complete: true }), { log: { ...emptyLog, complete: false } });
  t.after(fx.close);
  await assert.rejects(fx.observer.observe(fx.observation), (e: unknown) => marked(e) && /log is not flushed/.test((e as Error).message));
});

test('log cursor cannot claim bytes that were omitted from its page', async (t) => {
  const fx = await fixture(() => ({ events: [], nextSeq: 0, complete: true }), { log: { ...emptyLog, nextOffset: 10, totalBytes: 10 } });
  t.after(fx.close);
  await assert.rejects(fx.observer.observe(fx.observation), marked);
});

test('waitAndReport preserves archiveIncomplete and nested cause after HTTP archive failure', async (t) => {
  const fx = await fixture((after) => ({ events: [], nextSeq: after, complete: false }));
  t.after(fx.close);
  const logger = createLogger(false, () => undefined);
  logger.observeJob = (observation) => fx.observer.observe(observation);
  await assert.rejects(waitAndReport(fx.handle, terminal.id, 'deploy', logger, 1000), (e: unknown) => {
    assert.ok(marked(e));
    assert.ok(marked((e as Error).cause));
    assert.match((e as Error).message, /event cursor did not advance/);
    return true;
  });
  assert.deepEqual(fx.afters, [0, 0]); // active registration, then terminal poll fails safely
  assert.ok(!fx.records.some((event) => event.type === 'stage' && event.status === 'succeeded'));
});

const verification = (seq: number, service: string, detail?: string): JobEvent => ({
  seq, ts: 'test', phase: 'verify', service, event: detail ? 'probe' : 'phase', ...(detail ? { detail } : {}),
});
function serviceVerification(records: ExecutionEvent[]) {
  const last = new Map<string, string>();
  for (const event of records) if (event.type === 'stage' && event.stageKey === 'verify' && event.serviceKey) last.set(event.serviceKey, event.status!);
  return Object.fromEntries(last);
}

test('actual probe events finish each service separately without upgrading mixed skipped verification', async (t) => {
  const events = [verification(1, 'api'), verification(2, 'api', 'succeeded'), verification(3, 'web'), verification(4, 'web', 'skipped')];
  const fx = await fixture((after) => ({ events: events.filter((event) => event.seq > after), nextSeq: 4, complete: true }));
  t.after(fx.close);
  await fx.observer.observe({ ...fx.observation, job: { ...terminal, result: { verification: 'skipped', changedServices: ['api', 'web'] } } });
  assert.deepEqual(serviceVerification(fx.records), { api: 'succeeded', web: 'skipped' });
  assert.equal(fx.records.filter((event) => event.type === 'stage' && event.stageKey === 'verify' && !event.serviceKey).at(-1)?.status, 'skipped');
});

test('failed probe stays failed even when a terminal legacy summary claims all passed', async (t) => {
  const events = [verification(1, 'api'), verification(2, 'api', 'failed')];
  const fx = await fixture(() => ({ events, nextSeq: 2, complete: true })); t.after(fx.close);
  await fx.observer.observe({ ...fx.observation, job: { ...terminal, result: { verification: 'passed', changedServices: ['api'] } } });
  assert.deepEqual(serviceVerification(fx.records), { api: 'failed' });
});

test('legacy all-passed summary closes only observed running changed-service rows', async (t) => {
  const events = [verification(1, 'api'), verification(2, 'web')];
  const fx = await fixture((after) => ({ events: events.filter((event) => event.seq > after), nextSeq: 2, complete: true })); t.after(fx.close);
  const observation = { ...fx.observation, job: { ...terminal, result: { verification: 'passed', changedServices: ['api', 'web', 'never-observed'] } } };
  await fx.observer.observe(observation);
  assert.deepEqual(serviceVerification(fx.records), { api: 'succeeded', web: 'succeeded' });
  assert.equal(fx.records.filter((event) => event.detail?.inferredFromOverall).length, 2);
  await fx.observer.observe({ ...observation, final: true });
  assert.equal(fx.records.filter((event) => event.detail?.inferredFromOverall).length, 2);
});

test('legacy skipped summary remains overall skipped without inventing service success', async (t) => {
  const fx = await fixture(() => ({ events: [verification(1, 'api')], nextSeq: 1, complete: true })); t.after(fx.close);
  await fx.observer.observe({ ...fx.observation, job: { ...terminal, result: { verification: 'skipped', changedServices: ['api'] } } });
  assert.ok(!fx.records.some((event) => event.stageKey === 'verify' && event.serviceKey && event.status === 'succeeded'));
  assert.equal(fx.records.filter((event) => event.type === 'stage' && event.stageKey === 'verify' && !event.serviceKey).at(-1)?.status, 'skipped');
});

for (const failure of ['initial-mapping', 'log', 'remote-event', 'terminal-mapping', 'terminal-stage']) {
  test(`durable ${failure} failure carries archiveIncomplete and preserves its cause`, async (t) => {
    let mappings = 0;
    const cause = new Error('isolated disk failure');
    const fx = await fixture(() => ({ events: [entry(1)], nextSeq: 1, complete: true }), {
      log: { text: 'last bytes', nextOffset: 10, totalBytes: 10, complete: true },
      emit: async (event) => {
        if (event.type === 'remote-job') mappings++;
        if ((failure === 'initial-mapping' && event.type === 'remote-job' && mappings === 1)
          || (failure === 'terminal-mapping' && event.type === 'remote-job' && mappings === 2)
          || (failure === 'terminal-stage' && event.type === 'stage' && event.status === 'succeeded')
          || event.type === failure) throw cause;
      },
    });
    t.after(fx.close);
    await assert.rejects(fx.observer.observe(fx.observation), (e: unknown) => marked(e) && (e as Error).cause === cause);
  });
}
