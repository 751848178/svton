import { api } from '../shared/http.js';
import type { GroupStateView } from '../shared/group-protocol.js';
import { validateProjectSpec } from '../shared/spec-v2.js';
import type { ProjectInput } from './contracts.js';
import type { PrivatePlanOptions, PrivateProjectSnapshot } from './private-snapshot.js';
import { captureRuntimeProject } from './runtime-project.js';

export async function captureCurrentCombination(input: ProjectInput, _options: PrivatePlanOptions, kind: 'config-only' | 'rollback' = 'config-only'): Promise<PrivateProjectSnapshot> {
  const c = await captureRuntimeProject(input);
  if (c.existing?.currentServices && c.existing.currentReleaseId) return structuredClone(c.existing);
  const q = new URLSearchParams({ app: c.appName, project: c.identity, env: c.targetKey });
  const state = await api<GroupStateView>(c.runtime.url, c.runtime.token, 'GET', `/api/group-state?${q}`, undefined, 15000, c.runtime);
  if (!state.current || !Object.keys(state.services).length) throw new Error(kind === 'rollback' ? 'Historical snapshot is unavailable' : 'Configuration-only publication requires a committed deployment');
  const spec = validateProjectSpec({ schemaVersion: 2, name: c.appName, services: Object.fromEntries(Object.entries(state.services).map(([name, service]) => [name, service.spec])) });
  return { config: c.config, spec, identity: c.identity, runtime: c.runtime, targetKey: c.targetKey, rootPath: input.rootPath,
    configPath: c.configPath, envFiles: c.existing?.envFiles ?? {}, configRefs: c.existing?.configRefs, noEnvServices: c.existing?.noEnvServices,
    redactionValues: c.redactionValues, configDigest: c.configDigest, cloudCredentialDigests: c.cloudCredentialDigests,
    currentServices: state.services, currentReleaseId: state.current, caDigests: c.caDigests };
}
