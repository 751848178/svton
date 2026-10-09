import { api } from '../shared/http.js';
import { gitRemote } from '../shared/git.js';
import { buildReleasePlan, fetchGroupState } from '../cli/release-plan.js';
import { resolveSelection } from '../cli/service-selection.js';
import { readServiceEnvFiles } from '../cli/pipeline-group-deploy.js';
import { loadProject } from './project-context.js';
import { fingerprint } from './plan-fingerprint.js';
import type { ExecutionPlan, HistoryView, PlanRequest, ProjectInput } from './contracts.js';

export async function fetchHistory(input: ProjectInput): Promise<HistoryView> {
  const c = await loadProject(input);
  const q = new URLSearchParams({ app: c.spec.name, project: c.identity, env: c.targetKey });
  return api<HistoryView>(c.runtime.url, c.runtime.token, 'GET', `/api/group-history?${q}`, undefined, 15_000, c.runtime);
}

export async function preparePlan(input: ProjectInput, request: PlanRequest): Promise<ExecutionPlan> {
  const sourceMode = request.sourceMode ?? 'directory';
  const c = await loadProject(input, sourceMode);
  if (request.kind === 'release' && sourceMode === 'git' && !c.config.source?.repo && !await gitRemote(c.rootPath)) {
    throw new Error('Git source is not configured; use directory source or configure a repository');
  }
  const selection = resolveSelection(c.spec, request.services);
  const state = await fetchGroupState(c.config.runtime.targets[c.targetKey]!, `runtime.targets.${c.targetKey}`, c.spec.name, c.identity, c.targetKey);
  const keepEnv = Boolean(request.keepEnv);
  const detail: ExecutionPlan['detail'] = { targetKey: c.targetKey, projectIdentity: c.identity };
  if (request.kind === 'release') {
    detail.releasePlan = buildReleasePlan({ spec: c.spec, project: c.identity, env: c.targetKey,
      target: c.targetKey, selection, requested: request.services, state, keepEnv });
    readServiceEnvFiles(c.rootPath, c.spec, selection, keepEnv);
  } else {
    if (!request.changeReleaseId) throw new Error('Select a historical change to roll back');
    const q = new URLSearchParams({ app: c.spec.name, project: c.identity, env: c.targetKey });
    const history = await api<HistoryView>(c.runtime.url, c.runtime.token, 'GET', `/api/group-history?${q}`, undefined, 15_000, c.runtime);
    const item = history.items.find((i) => i.releaseId === request.changeReleaseId);
    if (!item?.rollbackAvailable) throw new Error(item?.reason ?? 'Historical snapshot is unavailable or outside retained history');
    if (selection.some((s) => !item.changedServices.includes(s))) throw new Error('Selected services are outside the historical change');
    detail.history = item;
  }
  const frozen = await fingerprint(c, sourceMode, keepEnv);
  Object.assign(detail, { sourceDigest: frozen.sourceDigest, gitRef: frozen.gitRef, configDigest: frozen.configDigest });
  return { kind: request.kind, selection, baseReleaseId: state.current,
    changeReleaseId: request.changeReleaseId, sourceMode, keepEnv, keepBuilder: Boolean(request.keepBuilder),
    fingerprint: frozen.fingerprint, expiresAt: new Date(Date.now() + 15 * 60_000).toISOString(), detail };
}
