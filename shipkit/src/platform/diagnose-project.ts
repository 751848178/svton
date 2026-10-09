import { access } from 'node:fs/promises';
import path from 'node:path';
import { loadProject } from './project-context.js';
import { inspectProject } from './inspect-project.js';
import type { ProjectInput } from './contracts.js';

/** Readiness checks are explicit about verification level and never provision a machine. */
export async function diagnoseProject(input: ProjectInput) {
  const c = await loadProject(input);
  const live = await inspectProject(input);
  const checks: Array<{ name: string; ok: boolean; level: string; detail: string }> = [
    { name: 'node', ok: Number(process.versions.node.split('.')[0]) >= 20, level: 'local', detail: process.version },
    { name: 'configuration', ok: true, level: 'validated', detail: 'Configuration and schemaVersion: 2 specification validated' },
    { name: 'source', ok: live.source.commit !== null, level: 'local-git', detail: live.source.commit ? `${live.source.branch ?? 'detached'} ${live.source.commit}; dirty=${live.source.dirty}` : 'No Git commit; directory upload is available' },
    { name: 'runtime', ok: live.runtime.check.ok, level: 'authenticated-agent', detail: live.runtime.check.error ?? `role=${live.runtime.check.role}; docker=${live.runtime.check.docker}; version=${live.runtime.check.version}` },
    { name: 'registry', ok: live.registry.configured, level: 'configuration-only', detail: 'Configured registry is not proof of a push/pull; actual release results provide that evidence' },
  ];
  const capabilities = live.runtime.check.capabilities ?? [];
  for (const capability of ['jobs-cooperative-cancel-v1', 'jobs-events-v1', 'jobs-log-cursor-v1', 'group-baseline-v1', 'group-target-rollback-v1']) {
    checks.push({ name: capability, ok: capabilities.includes(capability), level: 'authenticated-capability', detail: capabilities.includes(capability) ? 'Supported' : 'Missing; manually update the runtime Agent before platform execution' });
  }
  checks.push({ name: 'builder', ok: Boolean(live.builder.check?.ok), level: c.config.builder.mode === 'static' ? 'authenticated-agent' : 'not-provisioned',
    detail: c.config.builder.mode === 'static' ? live.builder.check?.error ?? `version=${live.builder.check?.version}; docker=${live.builder.check?.docker}` : 'Dynamic builder readiness is checked on explicit release; this check creates no resources' });
  for (const [service, spec] of Object.entries(c.spec.services)) {
    if (spec.envFile) {
      const exists = await access(path.resolve(c.rootPath, spec.envFile)).then(() => true, () => false);
      checks.push({ name: `env:${service}`, ok: exists, level: 'reference-exists', detail: exists ? 'Declared runtime env reference exists; content remains private' : 'Declared env is absent; create it or explicitly keep the committed env' });
    }
    checks.push({ name: `resources:${service}`, ok: true, level: 'declared-constraints',
      detail: `External networks=${spec.networks?.length ?? 0}, volumes=${spec.volumes?.length ?? 0}; availability and ownership are verified by the runtime under lock` });
  }
  return { live, checks };
}
