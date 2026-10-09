// Operation identity deduplication: reserve synchronously, resolve only after durable creation.
import { createHash } from 'node:crypto';
import type { Job, JobType } from '../shared/job-protocol.js';
import { HttpFail } from './http-fail.js';
export interface JobOperationMetadata { operationId?: string; request?: unknown }
export interface JobOperationIdentity { operationId?: string; requestHash?: string }
const OPERATION_RE = /^[A-Za-z0-9][A-Za-z0-9:._-]{0,199}$/;
export function validOperationId(value: unknown): value is string {
  return typeof value === 'string' && OPERATION_RE.test(value);
}
function canonical(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value)
    .filter(([, item]) => item !== undefined).sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0)
    .map(([name, item]) => [name, canonical(item)]));
  return value;
}
function identity(type: JobType, metadata?: JobOperationMetadata): JobOperationIdentity {
  if (metadata?.operationId === undefined) return {};
  if (!validOperationId(metadata.operationId)) throw new HttpFail(400, 'invalid_operation', 'operationId must be 1-200 letters, digits, colon, dot, underscore or hyphen');
  if (metadata.request === undefined) throw new HttpFail(400, 'invalid_operation', 'operationId requires a request payload for conflict protection');
  let request = metadata.request;
  if (request && typeof request === 'object' && !Array.isArray(request)) {
    const { operationId: _operationId, ...payload } = request as Record<string, unknown>;
    request = payload;
  }
  return { operationId: metadata.operationId, requestHash: createHash('sha256').update(JSON.stringify(canonical({ type, request }))).digest('hex') };
}
export class JobOperations {
  private readonly operations = new Map<string, { hash: string; promise: Promise<Job> }>();
  create(type: JobType, metadata: JobOperationMetadata | undefined, execute: (identity: JobOperationIdentity) => Promise<Job>): Promise<Job> {
    const key = identity(type, metadata);
    if (!key.operationId) return execute(key);
    const existing = this.operations.get(key.operationId);
    if (existing) {
      if (existing.hash !== key.requestHash) throw new HttpFail(409, 'operation_conflict', 'operationId already exists with a different request payload or job type');
      return existing.promise;
    }
    const promise = execute(key);
    this.operations.set(key.operationId, { hash: key.requestHash!, promise });
    return promise;
  }
  restore(job: Job): void {
    if (job.operationId === undefined) return;
    if (!validOperationId(job.operationId) || !/^[a-f0-9]{64}$/.test(job.requestHash ?? '')) throw new Error('persisted job operation identity is corrupt; preserve job records');
    if (this.operations.has(job.operationId)) throw new Error('duplicate persisted job operation identity; preserve job records and reconcile');
    this.operations.set(job.operationId, { hash: job.requestHash!, promise: Promise.resolve(job) });
  }
}
