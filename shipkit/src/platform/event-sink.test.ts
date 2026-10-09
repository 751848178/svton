import test from 'node:test';
import assert from 'node:assert/strict';
import { EventSink } from './event-sink.js';
import type { ExecutionEvent } from './contracts.js';

test('durable event writes are ordered, awaited and secret text is redacted without corrupting keys', async () => {
  const events: ExecutionEvent[] = [];
  const sink = new EventSink({
    emit: async (event) => { await new Promise((resolve) => setTimeout(resolve, 2)); events.push(event); },
    isCancellationRequested: async () => false,
  }, ['private-token', 'quoted"value']);
  sink.enqueue({ type: 'log', stageKey: 'build', message: 'private-token quoted"value' });
  await sink.emit({ type: 'remote-job', remoteJob: { jobId: 'id', agentRole: 'builder', urlRef: 'http://localhost:1', stageKey: 'build' } });
  await sink.flush();
  assert.equal(events.length, 2);
  assert.equal(events[0]?.message, '[redacted] [redacted]');
  assert.equal(events[1]?.remoteJob?.jobId, 'id');
});

test('local checkpoint confirms cancellation only before starting more remote work', async () => {
  const events: ExecutionEvent[] = [];
  const sink = new EventSink({ emit: async (e) => { events.push(e); }, isCancellationRequested: async () => true }, []);
  await assert.rejects(sink.checkpoint(), (e: unknown) => Boolean((e as { cancelled?: boolean }).cancelled));
  assert.equal(events[0]?.status, 'cancelled');
});

test('archive persistence failure stops checkpoints before resource release', async () => {
  const sink = new EventSink({ emit: async () => { throw new Error('disk unavailable'); }, isCancellationRequested: async () => false }, []);
  sink.enqueue({ type: 'log', message: 'must persist' });
  await assert.rejects(sink.checkpoint(), /disk unavailable/);
});
