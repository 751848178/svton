import { api } from '../shared/http.js';
import { gitRemote } from '../shared/git.js';
import { buildReleasePlan, fetchGroupState } from '../cli/release-plan.js';
import { resolveSelection } from '../cli/service-selection.js';
import { loadProject } from './project-context.js';
import { captureProject } from './capture-project.js';
import { snapshotFingerprint } from './private-fingerprint.js';
import { captureRuntimeProject } from './runtime-project.js';
import type { PrivatePlanOptions } from './private-snapshot.js';
import type { ExecutionPlan, HistoryView, PlanRequest, ProjectInput } from './contracts.js';

export async function fetchHistory(input: ProjectInput): Promise<HistoryView> {
  const c = await captureRuntimeProject(input);
  const q = new URLSearchParams({ app: c.appName, project: c.identity, env: c.targetKey });
  return api<HistoryView>(c.runtime.url, c.runtime.token, 'GET', `/api/group-history?${q}`, undefined, 15000, c.runtime);
}
export async function preparePlan(input: ProjectInput, request: PlanRequest, options: PrivatePlanOptions = {}): Promise<ExecutionPlan> {
  const snapshot = await captureProject(input, request, options);
  const configMode = request.configMode ?? (request.keepEnv ? 'inherit' : 'files');
  if (options.runtimeConfiguration) {
    const cfg = options.runtimeConfiguration;
    snapshot.envFiles = { ...cfg.envFiles }; snapshot.configRefs = { ...cfg.configRefs };
    snapshot.noEnvServices = [...(cfg.noEnvServices ?? [])]; snapshot.configFingerprint = cfg.fingerprint;
    snapshot.redactionValues.push(...(cfg.redactionValues ?? []));
  }
  await options.onPrivateSnapshot?.(snapshot);
  const sourceMode = snapshot.sourceSnapshot ? 'git' : request.sourceMode ?? 'directory';
  const c = await loadProject({ ...input, snapshot }, sourceMode);
  if (request.kind === 'release' && sourceMode === 'git' && !c.config.source?.repo && !await gitRemote(c.rootPath)) throw new Error('Git source is not configured');
  const selection = resolveSelection(c.spec, request.services);
  const state = await fetchGroupState(c.config.runtime.targets[c.targetKey]!, `runtime.targets.${c.targetKey}`, c.spec.name, c.identity, c.targetKey);
  const keepEnv = configMode === 'inherit';
  const detail: ExecutionPlan['detail'] = { targetKey: c.targetKey, projectIdentity: c.identity, snapshotVersion: 1,
    currentSources: Object.fromEntries(Object.entries(state.services).map(([name, value]) => [name, value.source ?? null])),
    currentConfigRefs: Object.fromEntries(Object.entries(state.services).map(([name, value]) => [name, value.configRef ?? null])) };
  if (request.kind === 'rollback') {
    if (!request.changeReleaseId) throw new Error('Select a historical change to roll back');
    const q = new URLSearchParams({ app: c.spec.name, project: c.identity, env: c.targetKey });
    const history = await api<HistoryView>(c.runtime.url, c.runtime.token, 'GET', `/api/group-history?${q}`, undefined, 15000, c.runtime);
    const item = history.items.find(i => i.releaseId === request.changeReleaseId);
    if (!item?.rollbackAvailable) throw new Error(item?.reason ?? 'Historical snapshot is unavailable');
    if (selection.some(s => !item.changedServices.includes(s))) throw new Error('Selected services are outside the historical change');
    detail.history = item;
  } else {
    if (request.kind === 'config-only' && !state.current) throw new Error('Configuration-only publication requires a committed deployment');
    if (request.kind === 'config-only' && selection.some(name => !/@sha256:[a-f0-9]{64}$/.test(state.services[name]?.imageRef ?? ''))) throw new Error('Configuration-only publication requires known digest-pinned images');
    if (configMode === 'version' && selection.some(name => !snapshot.configRefs?.[name] || !(name in snapshot.envFiles) && !snapshot.noEnvServices?.includes(name))) throw new Error('Frozen configuration does not cover every selected service');
    if (configMode === 'files' && selection.some(name => c.spec.services[name]?.envFile && !(name in snapshot.envFiles))) throw new Error('Runtime env file is missing; use a frozen platform configuration or inherit the committed env');
    detail.releasePlan = buildReleasePlan({ spec: c.spec, project: c.identity, env: c.targetKey, target: c.targetKey,
      selection, requested: request.services, state, keepEnv });
  }
  Object.assign(detail, { sourceDigest: snapshot.sourceDigest, gitRef: snapshot.gitRef, configDigest: snapshot.configDigest, sourceSnapshot: snapshot.sourceSnapshot });
  const configBindings = Object.fromEntries(selection.map(name => [name, { mode: configMode, ...(snapshot.configRefs?.[name] ? { configRef: snapshot.configRefs[name] } : {}) }]));
  return { kind: request.kind, selection, baseReleaseId: state.current, changeReleaseId: request.changeReleaseId,
    sourceMode, keepEnv, keepBuilder: Boolean(request.keepBuilder), configMode, configVersionId: request.configVersionId, configBindings,
    frozenConfig: { mode: configMode, versionId: request.configVersionId, bindings: configBindings },
    fingerprint: snapshotFingerprint(snapshot, sourceMode, keepEnv, configMode), expiresAt: new Date(Date.now() + 15 * 60000).toISOString(), detail };
}
