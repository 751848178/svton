import type { JobEvent, JobType } from '../shared/job-protocol.js';
import { sanitizeJobEvent } from '../shared/job-protocol-sanitizer.js';
import { sanitizeJobResult } from '../shared/job-result-sanitizer.js';
import { metadata, oneOf, record, text, type Field, type Fields, type RedactionPool } from '../shared/job-sanitizer-fields.js';
import { isRecord } from '../shared/obj.js';
import type { ExecutionEvent } from './contracts.js';

const remoteJob = record({ jobId: metadata, agentRole: oneOf('builder', 'runtime'), urlRef: metadata,
  stageKey: oneOf('build', 'push', 'deploy'), serviceKey: metadata, status: metadata, logOffset: metadata, eventOffset: metadata });
const intent = record({ operationId: metadata, agentRole: oneOf('builder', 'runtime'), urlRef: metadata });
const recovery: Field = (value, pool) => (sanitizeJobResult('group-deploy', { recovery: value }, pool) as { recovery: unknown }).recovery;
const lease: Fields = { mode: oneOf('static', 'dynamic'), provider: metadata, leaseRef: metadata, instanceId: metadata,
  builderRelease: oneOf('static', 'released', 'kept', 'failed', 'pending', 'not-needed', 'not-started') };
const remoteEvent: Field = (value, pool) => {
  if (!isRecord(value)) return text(value, pool);
  const { jobId, ...event } = value;
  return { ...sanitizeJobEvent(event as unknown as JobEvent, pool), ...(jobId !== undefined ? { jobId: metadata(jobId, pool) } : {}) };
};

/** Protect only fields whose owning event defines a machine-readable protocol. */
export function sanitizeExecutionEvent(event: ExecutionEvent, pool: RedactionPool): ExecutionEvent {
  let detail: Field = text;
  if (event.type === 'remote-intent') detail = intent;
  else if (event.type === 'remote-event') detail = remoteEvent;
  else if (event.type === 'recovery') detail = recovery;
  else if (event.type === 'cleanup') detail = record(lease);
  else if (event.type === 'cancel') detail = record({ jobId: metadata, phase: metadata, cancellable: metadata });
  else if (event.type === 'stage') {
    const type: JobType | undefined = event.stageKey === 'deploy' ? 'group-deploy' : ['build', 'push', 'verify'].includes(event.stageKey ?? '') ? event.stageKey as JobType : undefined;
    detail = record({ ...(event.stageKey === 'provision' || event.stageKey === 'cleanup' ? lease : {}),
      verification: oneOf('passed', 'skipped', 'failed'), inferredFromOverall: metadata,
      ...(type ? { result: (value, secrets) => sanitizeJobResult(type, value, secrets) } : {}) });
  }
  return record({ type: metadata, stageKey: metadata, serviceKey: metadata, status: metadata, message: text, detail,
    ...(event.type === 'remote-job' ? { remoteJob } : {}) })(event, pool) as ExecutionEvent;
}
