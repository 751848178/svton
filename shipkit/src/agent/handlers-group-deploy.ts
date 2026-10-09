// v2 group deploy (MS-03 + R02/R03): a transaction over full-combination
// snapshots. The request carries ONLY the changed services; inside the
// per-group lock the LATEST committed state is read and merged — two partial
// releases can never overwrite each other. Ordering: merge+snapshot → verify
// bindings → pre-pull ALL changed images → switch each changed service
// (identity re-verified per service) → verify health → commit. Any failure
// after switching restores exactly the changed services and RE-CHECKS their
// health; the reported recovery result is never inflated.

import path from 'node:path';
import type { GroupDeployRequest, GroupDeployResult, GroupRecoveryResult } from '../shared/group-protocol.js';
import { validateProjectSpec } from '../shared/spec-v2.js';
import { withAppLock, withDeploySlot } from './app-lock.js';
import { ImageLedger } from './image-ledger.js';
import { ledgerFileFor } from './gc.js';
import { assertProjectBinding, ProjectBindingRefusal } from './project-binding.js';
import { assertOwnedCompose } from './compose-ownership.js';
import { serviceProject } from './compose-service.js';
import { pullAuthCtx } from './docker.js';
import { resolvePullCreds } from './registry-creds.js';
import { GroupStore, type GroupRelease } from './group-store.js';
import { mergeCombination } from './group-merge.js';
import { pullServiceImage, switchService, verifyExternalBindings, verifyService } from './group-activation.js';
import { recoverServices, type RecoveryOutcome } from './group-recovery.js';
import type { JobContext } from './jobs.js';
import { JobCancelled, type JobControl } from './job-control.js';

type Log = JobContext['log'];

export class GroupDeployFailure extends Error {
  constructor(
    message: string,
    readonly recovery: GroupRecoveryResult,
  ) {
    super(message);
  }
}

export function describeRecovery(outcome: RecoveryOutcome, switchedCount: number): string {
  if (switchedCount === 0) return '(no service had switched before the failure — nothing to recover)';
  if (outcome.verification === 'passed') return `and re-verified healthy (${outcome.probed} probe(s))`;
  if (outcome.verification === 'skipped') {
    if (outcome.probed === 0) return '(restored; no probes passed — verification skipped, not verified)';
    // S04: a probe-less service in the mix keeps the summary PARTIAL — the
    // probed ones passing never upgrades the whole recovery to "verified"
    return `restored; verification PARTIAL — ${outcome.probed} probe(s) passed, ${outcome.probesSkipped} service(s) skipped (not verified)`;
  }
  return 'BUT verification failed — inspect the machine';
}

export async function runGroupDeploy(appsRoot: string, req: GroupDeployRequest, log: Log, control?: JobControl): Promise<GroupDeployResult> {
  const spec = validateProjectSpec(req.spec);
  if (spec.name !== req.app) throw new Error(`spec.name '${spec.name}' must equal the group name '${req.app}'`);
  const store = new GroupStore(appsRoot);
  const identity = { app: req.app, project: req.project, env: req.env };
  const result = await withDeploySlot(() => withAppLock(req.app, async () => {
    control?.checkpoint();
    control?.phase('prepare');
    const appDir = store.appDir(req.app);
    await store.assertLayout(req.app);
    const before = await store.loadState(req.app);
    if (req.baseReleaseId !== undefined && req.baseReleaseId !== before.current) throw new Error('release plan is stale: current baseline changed; refresh and retry');
    // pre-flight ownership of EVERY service project: a foreign same-named
    // project must be refused before this release writes anything
    let hasContainers = false;
    for (const name of Object.keys(spec.services)) {
      const owned = await assertOwnedCompose({ dir: store.servicesDir(req.app, name), project: serviceProject(req.app, name), service: name });
      hasContainers = hasContainers || owned;
    }
    await assertProjectBinding(appDir, identity, hasContainers);
    await store.claimLayout(req.app);

    control?.checkpoint();
    const current: GroupRelease | null = before.current ? await store.loadRelease(req.app, before.current) : null;
    const { combination, changedServices } = mergeCombination({ group: req.app, specs: spec.services, changed: req.changed, current });
    const inheritedServices = Object.keys(combination).filter((s) => !changedServices.includes(s));
    log(`group ${req.app}: changing [${changedServices.join(', ')}], inheriting [${inheritedServices.join(', ')}]`);

    const release = await store.saveRelease(req.app, { parent: before.current, changedServices, services: combination });
    const firstChanged = combination[changedServices[0] ?? ''];
    if (!firstChanged) throw new Error('internal: changed set is empty after merge');
    const pullCtx = await pullAuthCtx(firstChanged.imageRef, log, await resolvePullCreds(path.dirname(appsRoot))).catch((e: unknown) => {
      log(`pull login failed: ${(e as Error).message}`);
      return null;
    });
    try {
      await verifyExternalBindings(spec.services, changedServices, log);
      for (const name of changedServices) {
        control?.checkpoint();
        control?.phase('pull', name);
        const entry = combination[name];
        if (!entry) throw new Error(`internal: combination entry for '${name}' missing after merge`);
        await pullServiceImage(entry.imageRef, log, pullCtx?.env);
        control?.checkpoint();
      }
      const switched: string[] = [];
      const fail = async (reason: string, cause?: unknown): Promise<never> => {
        control?.enterRecovery();
        const outcome = await recoverServices({ appsRoot, group: req.app, identity, previousCombination: current?.services ?? null, changedSoFar: switched, log, env: pullCtx?.env,
          bindingRefusal: cause instanceof ProjectBindingRefusal ? cause.message : undefined });
        const recovery: GroupRecoveryResult = { attempted: true, ...outcome, target: current ? switched.map((s) => current.services[s]?.imageRef ?? '').filter(Boolean).join(', ') || null : null };
        if (cause instanceof JobCancelled && outcome.succeeded) throw new JobCancelled(reason, recovery);
        throw new GroupDeployFailure(
          `${reason}; recovery of changed services [${switched.join(', ')}] ${current ? 'to the previous combination ' : '(first deploy: verified removal) '}${outcome.succeeded ? 'succeeded ' + describeRecovery(outcome, switched.length) : `FAILED (${outcome.detail}) — inspect the machine`}`,
          recovery,
        );
      };
      try {
        for (const name of changedServices) {
          control?.checkpoint();
          control?.phase('activate', name);
          const entry = combination[name];
          if (!entry) throw new Error(`internal: combination entry for '${name}' missing after merge`);
          await switchService({
            appsRoot, group: req.app, service: name, entry, identity, log, env: pullCtx?.env,
            onBeforeUp: () => { switched.push(name); },
          });
          control?.checkpoint();
        }
        const changedRefs: Record<string, string> = {};
        let skipped = false;
        for (const name of changedServices) {
          control?.checkpoint();
          control?.phase('verify', name);
          const entry = combination[name];
          if (!entry) throw new Error(`internal: combination entry for '${name}' missing after merge`);
          changedRefs[name] = entry.imageRef;
          const v = await verifyService({ appsRoot, group: req.app, service: name, entry, log, checkpoint: () => control?.checkpoint() });
          control?.verified?.(name, !v.ok ? 'failed' : v.skipped ? 'skipped' : 'succeeded');
          control?.checkpoint();
          if (!v.ok) await fail(`health check failed for changed service '${name}'`);
          if (v.skipped) skipped = true;
        }
        try {
          control?.enterCommit();
          // Health polling yields after activation. Never commit a release to
          // a project/environment whose binding changed while probes ran.
          const { cleanupError } = await store.shift(req.app, release.id, 'deploy',
            () => assertProjectBinding(appDir, identity, false, false));
          if (cleanupError) log(`release snapshot cleanup failed after successful state commit: ${cleanupError}`);
        } catch (e) {
          await fail(`deploy state commit failed: ${(e as Error).message}`, e);
        }
        return {
          app: req.app,
          releaseId: release.id,
          previousReleaseId: before.current,
          changedServices,
          inheritedServices,
          changedRefs,
          verification: skipped ? ('skipped' as const) : ('passed' as const),
        };
      } catch (e) {
        if (e instanceof GroupDeployFailure || (e instanceof JobCancelled && e.recovery)) throw e;
        throw await fail(`deploy of [${changedServices.join(', ')}] failed: ${(e as Error).message}`, e);
      }
    } finally {
      await pullCtx?.cleanup();
    }
  }));
  // record changed images for future GC (best-effort; never blocks a deploy)
  const ledger = new ImageLedger(ledgerFileFor(appsRoot));
  for (const [name, ref] of Object.entries(result.changedRefs)) {
    await ledger.record(ref, `${result.app}:${name}`).catch((e: unknown) => log(`image ledger record failed for ${name}: ${(e as Error).message}`));
  }
  return result;
}
