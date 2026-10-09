// Resolve a rollback's changed set and immutable parent snapshot inside the group lock.
import type { GroupRollbackRequest } from '../shared/group-protocol.js';
import { GroupStore, type GroupRelease, type GroupState } from './group-store.js';
export async function rollbackSelection(store: GroupStore, req: GroupRollbackRequest, state: GroupState, current: GroupRelease) {
  let target = current;
  if (req.targetReleaseId) {
    if (!req.baseReleaseId) throw new Error('historical rollback requires baseReleaseId to protect the current baseline');
    if (!state.history.some((entry) => entry.releaseId === req.targetReleaseId)) {
      throw new Error('targetReleaseId is outside the committed history of this deployment');
    }
    target = await store.loadRelease(req.app, req.targetReleaseId);
  }
  const services = [...new Set(req.services ?? target.changedServices)];
  if (!services.length) throw new Error('rollback service selection is empty');
  for (const name of services) {
    if (!current.services[name]) throw new Error(`service '${name}' is outside the current deployment`);
    if (req.targetReleaseId && !target.changedServices.includes(name)) throw new Error(`service '${name}' was not changed by target release '${target.id}'`);
  }
  let restoreId = target.parent;
  if (!req.targetReleaseId && req.services) {
    restoreId = null;
    for (const item of state.history) {
      if (!services.every((name) => item.changedServices.includes(name))) continue;
      const candidate = await store.loadRelease(req.app, item.releaseId).catch(() => null);
      if (candidate?.parent) { restoreId = candidate.parent; break; }
    }
  }
  if (!restoreId) {
    if (req.services && !req.targetReleaseId) throw new Error(`no history snapshot contains ALL of [${services.join(', ')}] in one release's changed set`);
    throw new Error(`release '${target.id}' is the first deployment — no previous combination to restore`);
  }
  const restoreFrom = await store.loadRelease(req.app, restoreId);
  for (const name of services) {
    const entry = restoreFrom.services[name];
    if (!entry) throw new Error(`restore source '${restoreId}' has no snapshot for service '${name}'`);
    if (!/@sha256:[0-9a-f]{64}$/.test(entry.imageRef)) throw new Error(`restore source '${restoreId}' service '${name}' holds a non-digest-pinned ref`);
  }
  return { services, restoreFrom };
}
