// Job and event protocol metadata must survive even one-character secret values.
import type { Job, JobEvent } from './job-protocol.js';
import type { RedactionPool } from './job-sanitizer-fields.js';
import { metadata, oneOf, record, text, type Fields } from './job-sanitizer-fields.js';
import { sanitizeJobResult } from './job-result-sanitizer.js';

const phases = oneOf('queued', 'source', 'build', 'push', 'prepare', 'pull', 'activate', 'verify', 'recover', 'commit', 'complete');
const statuses = oneOf('queued', 'running', 'cancel-requested', 'cancelled', 'succeeded', 'failed');
const jobFields: Fields = {
  id: metadata, type: oneOf('build', 'push', 'deploy', 'rollback', 'gc', 'verify', 'group-deploy', 'group-rollback'),
  status: statuses, createdAt: metadata, updatedAt: metadata, phase: phases, service: metadata,
  cancellable: metadata, operationId: metadata, requestHash: metadata, error: text,
  cancellation: record({ requestedAt: metadata, outcome: oneOf('requested', 'cancelled', 'recovery-failed'), reason: text }),
};
export function sanitizeJob(job: Job, secrets: RedactionPool): Job {
  return record({ ...jobFields, result: (value, pool) => sanitizeJobResult(job.type, value, pool) })(job, secrets) as Job;
}
export function sanitizeJobEvent(event: JobEvent, secrets: RedactionPool): JobEvent {
  const detail = event.phase === 'verify' && event.event === 'probe' ? oneOf('succeeded', 'skipped', 'failed') : text;
  return record({ seq: metadata, ts: metadata, phase: phases,
    event: oneOf('created', 'phase', 'probe', 'interrupted', 'cancel-requested', 'queued', 'running', 'cancelled', 'succeeded', 'failed'),
    service: metadata, detail })(event, secrets) as JobEvent;
}
