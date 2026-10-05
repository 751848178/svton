// v2 group rollback (MS-04 + R02/R03): default undoes the LAST release's
// changedServices by restoring them from the parent combination; explicit
// --services walks the history for the newest release whose changed set covers
// the request and restores those services from ITS parent. A stale plan
// (baseReleaseId ≠ current) is rejected. The rollback itself is a NEW full
// release record; identity is re-verified per service and recovery outcomes
// are reported honestly.

import path from 'node:path';
import type { GroupDeployResult, GroupRollbackRequest } from '../shared/group-protocol.js';
import { withAppLock, withDeploySlot } from './app-lock.js';
import { ImageLedger } from './image-ledger.js';
import { ledgerFileFor } from './gc.js';
import { assertProjectBinding } from './project-binding.js';
import { assertOwnedCompose } from './compose-ownership.js';
import { serviceProject } from './compose-service.js';
import { pullAuthCtx } from './docker.js';
import { resolvePullCreds } from './registry-creds.js';
import { GroupStore, type GroupRelease } from './group-store.js';
import { pullServiceImage, switchService, verifyService } from './group-activation.js';
import { recoverServices } from './group-recovery.js';
import { GroupDeployFailure, describeRecovery } from './handlers-group-deploy.js';
import type { JobContext } from './jobs.js';

type Log = JobContext['log'];

interface HistoryEntry { releaseId: string; parentId: string | null; changedServices: string[] }

/** newest history release whose changed set covers `services` (and has a parent) */
function findRestoreSource(history: HistoryEntry[], services: string[]): string | null {
  for (const h of history) {
    if (h.parentId && services.every((s) => h.changedServices.includes(s))) return h.parentId;
  }
  return null;
}

export async function runGroupRollback(appsRoot: string, req: GroupRollbackRequest, log: Log): Promise<GroupDeployResult> {
  const store = new GroupStore(appsRoot);
  const identity = { app: req.app, project: req.project, env: req.env };
  const result = await withDeploySlot(() => withAppLock(req.app, async () => {
    const appDir = store.appDir(req.app);
    await store.assertLayout(req.app);
    const state = await store.loadState(req.app);
    if (!state.current) throw new Error(`group '${req.app}' has no current release to roll back`);
    if (req.baseReleaseId !== undefined && req.baseReleaseId !== state.current) {
      throw new Error(`rollback plan is stale: planned against release '${req.baseReleaseId}' but current is '${state.current}' — another release landed in between; refresh and retry`);
    }
    const current = await store.loadRelease(req.app, state.current);
    for (const name of Object.keys(current.services)) {
      await assertOwnedCompose({ dir: store.servicesDir(req.app, name), project: serviceProject(req.app, name), service: name });
    }
    await assertProjectBinding(appDir, identity, true);

    const services = req.services ?? current.changedServices;
    if (services.length === 0) throw new Error(`current release '${current.id}' records no changed services — nothing to roll back`);
    let restoreFromId: string | null = null;
    if (!req.services) {
      restoreFromId = current.parent;
      if (!restoreFromId) throw new Error(`current release '${current.id}' is the first deployment — no previous combination to restore`);
    } else {
      const withParents: HistoryEntry[] = [];
      for (const h of [{ releaseId: current.id, parentId: current.parent, changedServices: current.changedServices },
        ...state.history.map((h) => ({ releaseId: h.releaseId, parentId: null as string | null, changedServices: h.changedServices }))]) {
        const rel = h.releaseId === current.id ? current : await store.loadRelease(req.app, h.releaseId).catch(() => null);
        withParents.push({ ...h, parentId: h.parentId ?? rel?.parent ?? null });
      }
      restoreFromId = findRestoreSource(withParents, services);
      if (!restoreFromId) {
        throw new Error(`no history snapshot contains ALL of [${services.join(', ')}] in one release's changed set — cannot resolve a restore source; use --services with an exact set that was released together`);
      }
    }
    const restoreFrom = await store.loadRelease(req.app, restoreFromId);
    const combination = { ...current.services };
    const changedRefs: Record<string, string> = {};
    for (const name of services) {
      const entry = restoreFrom.services[name];
      if (!entry) throw new Error(`restore source release '${restoreFrom.id}' has no snapshot for service '${name}' — cannot roll back`);
      // defense-in-depth: even a hand-edited/foreign snapshot cannot smuggle a
      // mutable tag back into activation through rollback
      if (!/@sha256:[0-9a-f]{64}$/.test(entry.imageRef)) {
        throw new Error(`restore source '${restoreFrom.id}' service '${name}' holds a non-digest-pinned ref (${entry.imageRef}) — refusing rollback; inspect the snapshot`);
      }
      combination[name] = entry;
      changedRefs[name] = entry.imageRef;
    }
    const firstTarget = changedRefs[services[0] ?? ''];
    if (!firstTarget) throw new Error('internal: rollback target set is empty');
    log(`rolling back group ${req.app} services [${services.join(', ')}] from release ${restoreFrom.id}`);

    const release = await store.saveRelease(req.app, { parent: state.current, changedServices: services, services: combination });
    const pullCtx = await pullAuthCtx(firstTarget, log, await resolvePullCreds(path.dirname(appsRoot))).catch(() => null);
    try {
      for (const name of services) {
        const entry = combination[name];
        if (!entry) throw new Error(`internal: rollback combination entry for '${name}' missing`);
        await pullServiceImage(entry.imageRef, log, pullCtx?.env);
      }
      const switched: string[] = [];
      try {
        for (const name of services) {
          const entry = combination[name];
          if (!entry) throw new Error(`internal: rollback combination entry for '${name}' missing`);
          await switchService({
            appsRoot, group: req.app, service: name, entry, identity, log, env: pullCtx?.env,
            onBeforeUp: () => { switched.push(name); },
          });
        }
        let skipped = false;
        for (const name of services) {
          const entry = combination[name];
          if (!entry) throw new Error(`internal: rollback combination entry for '${name}' missing`);
          const v = await verifyService({ appsRoot, group: req.app, service: name, entry, log });
          if (!v.ok) throw new Error(`health check failed for restored service '${name}'`);
          if (v.skipped) skipped = true;
        }
        const { cleanupError } = await store.shift(req.app, release.id, 'rollback');
        if (cleanupError) log(`release snapshot cleanup failed after successful state commit: ${cleanupError}`);
        return {
          app: req.app, releaseId: release.id, previousReleaseId: state.current,
          changedServices: services, inheritedServices: Object.keys(combination).filter((s) => !services.includes(s)),
          changedRefs, verification: skipped ? ('skipped' as const) : ('passed' as const),
        };
      } catch (e) {
        const outcome = await recoverServices({ appsRoot, group: req.app, identity, previousCombination: current.services, changedSoFar: switched, log, env: pullCtx?.env });
        throw new GroupDeployFailure(
          `rollback of [${services.join(', ')}] failed: ${(e as Error).message}; recovery to the pre-rollback combination ${outcome.succeeded ? 'succeeded ' + describeRecovery(outcome, switched.length) : `FAILED (${outcome.detail}) — inspect the machine`}`,
          { attempted: true, ...outcome, target: switched.map((s) => current.services[s]?.imageRef ?? '').filter(Boolean).join(', ') || null },
        );
      }
    } finally {
      await pullCtx?.cleanup();
    }
  }));
  const ledger = new ImageLedger(ledgerFileFor(appsRoot));
  for (const [name, ref] of Object.entries(result.changedRefs)) {
    await ledger.record(ref, `${result.app}:${name}`).catch((e: unknown) => log(`image ledger record failed for ${name}: ${(e as Error).message}`));
  }
  return result;
}
