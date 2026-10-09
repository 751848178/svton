import { realpathSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { loadConfig } from '../shared/config.js';
import { resolveTarget } from '../cli/targets.js';
import { resolveProjectId } from '../cli/project-id.js';
import { resolveTargetToken } from '../shared/credentials.js';
import { loadSpecAnyAt } from '../shared/spec-load.js';
import type { ProjectInput } from './contracts.js';
import { assertSnapshotTrust } from './private-fingerprint.js';
import { cloudCredentialDigests, cloudCredentialValues } from './cloud-credential-trust.js';

/** Locate the committed Runtime group without reading repository metadata or a builder. */
export async function captureRuntimeProject(input: ProjectInput) {
  const existing = input.snapshot ?? input.privateSnapshot;
  if (existing) await assertSnapshotTrust({ ...existing, executionKind: 'rollback' });
  if (!existing && !input.configPath) throw new Error('Runtime operations require a connection profile');
  const configPath = existing?.configPath ?? realpathSync(input.configPath!), config = existing ? structuredClone(existing.config) : loadConfig(configPath);
  if (input.repository && !existing) config.source = { repo: input.repository.repoUrl };
  const appName = input.appName ?? existing?.spec.name ?? input.sourceSnapshot?.appName ?? (!input.repository && input.rootPath ? loadSpecAnyAt(input.rootPath).spec.name : undefined);
  if (!appName) throw new Error('Runtime operations require the registered appName');
  if (existing && (existing.spec.name !== appName || input.targetKey && input.targetKey !== existing.targetKey || input.projectIdentity && input.projectIdentity !== existing.identity)) throw new Error('Private execution snapshot belongs to a different project or target');
  const target = resolveTarget(config, input.targetKey ?? existing?.targetKey);
  const runtime = existing?.runtime ?? await resolveTargetToken(target.target, `runtime.targets.${target.name}`);
  const identity = existing?.identity ?? input.projectIdentity ?? await resolveProjectId(input.rootPath ?? process.cwd(), config, !input.repository ? input.rootPath : undefined);
  const caDigests: Record<string, string> = { ...existing?.caDigests };
  for (const [name, connection] of Object.entries(config.runtime.targets)) {
    const resolved = await resolveTargetToken(connection, `runtime.targets.${name}`);
    if (resolved.caFile && !existing) caDigests[resolved.caFile] = createHash('sha256').update(await readFile(resolved.caFile)).digest('hex');
    config.runtime.targets[name] = { url: resolved.url, token: resolved.token, ...(resolved.caFile ? { caFile: resolved.caFile } : {}) };
  }
  // A Runtime-only operation cannot use a mutable builder credential reference.
  if (config.builder.static?.tokenRef) delete config.builder.static;
  return { existing, configPath, config, appName, runtime, identity, targetKey: target.name, caDigests,
    cloudCredentialDigests: existing?.cloudCredentialDigests ?? cloudCredentialDigests(config),
    redactionValues: existing?.redactionValues ?? [runtime.token, ...cloudCredentialValues(config)],
    configDigest: existing?.configDigest ?? createHash('sha256').update(await readFile(configPath)).digest('hex') };
}
