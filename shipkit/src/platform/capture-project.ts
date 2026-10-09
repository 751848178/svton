import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { resolveTargetToken } from '../shared/credentials.js';
import type { ShipConfig } from '../shared/types.js';
import type { ProjectInput, PlanRequest } from './contracts.js';
import type { PrivateProjectSnapshot, PrivatePlanOptions } from './private-snapshot.js';
import { loadProject, privateValues } from './project-context.js';
import { fingerprint } from './plan-fingerprint.js';
import { captureCurrentCombination } from './config-only.js';
import { assertSnapshotTrust } from './private-fingerprint.js';
import { cloudCredentialDigests, cloudCredentialValues } from './cloud-credential-trust.js';

export async function captureProject(input: ProjectInput, request: PlanRequest, options: PrivatePlanOptions = {}): Promise<PrivateProjectSnapshot> {
  if (request.kind === 'config-only' || request.kind === 'rollback') return { ...await captureCurrentCombination(input, options, request.kind), executionKind: request.kind };
  const updated = input.repository && !(input.snapshot ?? input.privateSnapshot) ? { ...input, sourceSnapshot: undefined,
    repository: { ...input.repository, ref: request.sourceRef ?? input.repository.ref } } : input;
  const mode = input.repository ? 'git' : request.sourceMode ?? 'directory';
  const c = await loadProject(updated, mode, options);
  if (c.snapshot) await assertSnapshotTrust(c);
  const config = structuredClone(c.config) as ShipConfig;
  const caDigests: Record<string, string> = { ...c.caDigests };
  const resolve = async (target: NonNullable<ShipConfig['builder']['static']>, key: string) => {
    const value = await resolveTargetToken(target, key);
    if (value.caFile && !c.snapshot) caDigests[value.caFile] = createHash('sha256').update(await readFile(value.caFile)).digest('hex');
    return { url: value.url, token: value.token, ...(value.caFile ? { caFile: value.caFile } : {}) };
  };
  for (const [name, target] of Object.entries(config.runtime.targets)) config.runtime.targets[name] = await resolve(target, `runtime.targets.${name}`);
  if (config.builder.static) config.builder.static = await resolve(config.builder.static, 'builder.static');
  const frozen = c.snapshot ? { envSnapshot: {} as Record<string, string>, configDigest: c.configDigest, sourceDigest: c.sourceDigest, gitRef: c.gitRef }
    : await fingerprint(c, mode, request.keepEnv || request.configMode === 'inherit' || request.configMode === 'version');
  const envFiles: Record<string, string> = { ...c.envFiles };
  if (!c.snapshot && !c.sourceSnapshot && request.configMode !== 'version' && !request.keepEnv && request.configMode !== 'inherit') {
    for (const [name, service] of Object.entries(c.spec.services)) if (service.envFile && frozen.envSnapshot[service.envFile] !== undefined) envFiles[name] = frozen.envSnapshot[service.envFile]!;
  }
  return { executionKind: request.kind, config, spec: c.spec, identity: c.identity, runtime: { ...c.runtime, token: config.runtime.targets[c.targetKey]!.token! }, targetKey: c.targetKey,
    rootPath: c.rootPath, configPath: c.configPath, envFiles, redactionValues: [...privateValues(c), ...cloudCredentialValues(config)], sourceSnapshot: c.sourceSnapshot,
    configDigest: frozen.configDigest, sourceDigest: frozen.sourceDigest, gitRef: c.sourceSnapshot?.commit ?? frozen.gitRef, caDigests,
    cloudCredentialDigests: c.snapshot ? c.cloudCredentialDigests : cloudCredentialDigests(config),
    ...(c.snapshot ? { configRefs: c.configRefs, noEnvServices: c.noEnvServices, configFingerprint: c.configFingerprint } : {}) };
}
