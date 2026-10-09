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
import { assertProjectBinding, ProjectBindingRefusal } from './project-binding.js';
import { assertOwnedCompose } from './compose-ownership.js';
import { serviceProject } from './compose-service.js';
import { pullAuthCtx } from './docker.js';
import { resolvePullCreds } from './registry-creds.js';
import { GroupStore, type GroupRelease } from './group-store.js';
import { pullServiceImage, switchService, verifyService } from './group-activation.js';
import { recoverServices } from './group-recovery.js';
import { GroupDeployFailure, describeRecovery } from './handlers-group-deploy.js';
import type { JobContext } from './jobs.js';
import { JobCancelled, type JobControl } from './job-control.js';
import { rollbackSelection } from './group-rollback-selection.js';

type Log = JobContext['log'];

export async function runGroupRollback(appsRoot: string, req: GroupRollbackRequest, log: Log, control?: JobControl): Promise<GroupDeployResult> {
  const store = new GroupStore(appsRoot);
  const identity = { app: req.app, project: req.project, env: req.env };
  const result = await withDeploySlot(() => withAppLock(req.app, async () => {
    control?.checkpoint();
    control?.phase('prepare');
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

    const { services, restoreFrom } = await rollbackSelection(store, req, state, current);
    control?.checkpoint();
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
        control?.checkpoint();
        control?.phase('pull', name);
        const entry = combination[name];
        if (!entry) throw new Error(`internal: rollback combination entry for '${name}' missing`);
        await pullServiceImage(entry.imageRef, log, pullCtx?.env);
        control?.checkpoint();
      }
      const switched: string[] = [];
      try {
        for (const name of services) {
          control?.checkpoint();
          control?.phase('activate', name);
          const entry = combination[name];
          if (!entry) throw new Error(`internal: rollback combination entry for '${name}' missing`);
          await switchService({
            appsRoot, group: req.app, service: name, entry, identity, log, env: pullCtx?.env,
            onBeforeUp: () => { switched.push(name); },
          });
          control?.checkpoint();
        }
        let skipped = false;
        for (const name of services) {
          control?.checkpoint();
          control?.phase('verify', name);
          const entry = combination[name];
          if (!entry) throw new Error(`internal: rollback combination entry for '${name}' missing`);
          const v = await verifyService({ appsRoot, group: req.app, service: name, entry, log, checkpoint: () => control?.checkpoint() });
          control?.verified?.(name, !v.ok ? 'failed' : v.skipped ? 'skipped' : 'succeeded');
          control?.checkpoint();
          if (!v.ok) throw new Error(`health check failed for restored service '${name}'`);
          if (v.skipped) skipped = true;
        }
        control?.enterCommit();
        const { cleanupError } = await store.shift(req.app, release.id, 'rollback',
          () => assertProjectBinding(appDir, identity, false, false));
        if (cleanupError) log(`release snapshot cleanup failed after successful state commit: ${cleanupError}`);
        return {
          app: req.app, releaseId: release.id, previousReleaseId: state.current,
          changedServices: services, inheritedServices: Object.keys(combination).filter((s) => !services.includes(s)),
          changedRefs, verification: skipped ? ('skipped' as const) : ('passed' as const),
        };
      } catch (e) {
        control?.enterRecovery();
        const outcome = await recoverServices({ appsRoot, group: req.app, identity, previousCombination: current.services, changedSoFar: switched, log, env: pullCtx?.env,
          bindingRefusal: e instanceof ProjectBindingRefusal ? e.message : undefined });
        const recovery = { attempted: true as const, ...outcome, target: switched.map((s) => current.services[s]?.imageRef ?? '').filter(Boolean).join(', ') || null };
        if (e instanceof JobCancelled && outcome.succeeded) throw new JobCancelled(e.message, recovery);
        throw new GroupDeployFailure(
          `rollback of [${services.join(', ')}] failed: ${(e as Error).message}; recovery to the pre-rollback combination ${outcome.succeeded ? 'succeeded ' + describeRecovery(outcome, switched.length) : `FAILED (${outcome.detail}) — inspect the machine`}`,
          recovery,
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
