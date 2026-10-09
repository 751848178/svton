// Result schemas preserve machine-readable refs and filter diagnostics/unknown extensions.
import type { JobType } from './job-protocol.js';
import type { RedactionPool } from './job-sanitizer-fields.js';
import { configRef, list, mapping, metadata, oneOf, record, serviceEntry, source, text, type Fields } from './job-sanitizer-fields.js';

const recovery = record({ attempted: metadata, succeeded: metadata, target: metadata,
  verification: oneOf('passed', 'failed', 'skipped'), cleaned: list(metadata), pending: list(metadata),
  probed: metadata, probesFailed: metadata, probesSkipped: metadata, detail: text });
const deployment: Fields = { app: metadata, imageRef: metadata, releaseId: metadata, previousReleaseId: metadata,
  verification: oneOf('passed', 'skipped'), recovery,
  source, configRef, configRefs: mapping(configRef), services: mapping(serviceEntry) };
const group: Fields = { ...deployment, changedServices: list(metadata), inheritedServices: list(metadata), changedRefs: mapping(metadata) };
const schemas: Record<JobType, Fields> = {
  build: { name: metadata, tag: metadata, localImage: metadata, sha: metadata, arch: metadata, source, configRef },
  push: { imageRef: metadata, digest: metadata },
  deploy: deployment, rollback: deployment, 'group-deploy': group, 'group-rollback': group,
  verify: { level: oneOf('push-verified', 'pull-verified'), imageRef: metadata, digest: metadata, testObject: metadata },
  gc: { removed: list(metadata), skippedProtected: list(metadata), missing: list(metadata),
    failed: list(record({ imageRef: metadata, error: text })), protectedRefs: list(metadata),
    candidates: list(record({ imageRef: metadata, app: metadata, addedAt: metadata })) },
};
export function sanitizeJobResult(type: JobType, value: unknown, secrets: RedactionPool): unknown {
  return record(Object.hasOwn(schemas, type) ? schemas[type] : {})(value, secrets);
}
