// v2 group deploy (MS-03): a transaction over full-combination snapshots.
// The request carries ONLY the changed services; inside the per-group lock the
// LATEST committed state is read and merged — two partial releases can never
// overwrite each other. Ordering: merge+snapshot → verify bindings → pre-pull
// ALL changed images → switch each changed service → verify health → commit.
// Any failure after switching restores exactly the changed services.

import path from 'node:path';
import type { GroupDeployRequest, GroupDeployResult, GroupServiceChange } from '../shared/group-protocol.js';
import { validateProjectSpec, type ServiceSpec } from '../shared/spec-v2.js';
import { withAppLock, withDeploySlot } from './app-lock.js';
import { ImageLedger } from './image-ledger.js';
import { ledgerFileFor } from './gc.js';
import { assertProjectBinding } from './project-binding.js';
import { assertOwnedCompose } from './compose-ownership.js';
import { serviceProject } from './compose-service.js';
import { pullAuthCtx } from './docker.js';
import { resolvePullCreds } from './registry-creds.js';
import { GroupStore, type GroupRelease, type GroupServiceEntry, type GroupServiceSource } from './group-store.js';
import { pullServiceImage, recoverServices, switchService, verifyExternalBindings, verifyService } from './group-activation.js';
import type { JobContext } from './jobs.js';

type Log = JobContext['log'];

export class GroupDeployFailure extends Error {
  constructor(
    message: string,
    readonly recovery: { attempted: true; succeeded: boolean; target: string | null },
  ) {
    super(message);
  }
}

function sameSpec(a: ServiceSpec, b: ServiceSpec): boolean {
  const norm = (v: unknown): unknown => {
    if (Array.isArray(v)) return [...v].sort();
    if (v && typeof v === 'object') {
      return Object.fromEntries(Object.entries(v as Record<string, unknown>).sort(([x], [y]) => x.localeCompare(y)).map(([k, val]) => [k, norm(val)]));
    }
    return v;
  };
  return JSON.stringify(norm(a)) === JSON.stringify(norm(b));
}

function toSource(change: GroupServiceChange): GroupServiceSource | undefined {
  if (!change.source) return undefined;
  return { type: change.source.type, sha: change.source.sha, repo: change.source.repo, ref: change.source.ref };
}

/** merge changed services on top of the LATEST committed combination */
export function mergeCombination(o: {
  group: string;
  specs: Record<string, ServiceSpec>;
  changed: Record<string, GroupServiceChange>;
  current: GroupRelease | null;
}): { combination: Record<string, GroupServiceEntry>; changedServices: string[] } {
  const { group, specs, changed, current } = o;
  for (const name of Object.keys(changed)) {
    if (!specs[name]) throw new Error(`changed service '${name}' is not declared in the group spec`);
  }
  for (const name of Object.keys(current?.services ?? {})) {
    if (!(name in specs)) {
      throw new Error(`service '${name}' exists in the current combination but is absent from the new spec — removing a running service requires explicit migration, not a release`);
    }
  }
  const combination: Record<string, GroupServiceEntry> = {};
  const changedServices: string[] = [];
  for (const [name, svcSpec] of Object.entries(specs)) {
    const change = changed[name];
    if (change) {
      changedServices.push(name);
      let env: string | undefined;
      if (typeof change.envFileContent === 'string') env = change.envFileContent;
      else if (change.keepEnv) {
        const prevEnv = current?.services[name]?.env;
        if (prevEnv === undefined) throw new Error(`keepEnv for '${name}' requires a committed env in the current combination — pass envFileContent instead`);
        env = prevEnv;
      }
      combination[name] = { imageRef: change.imageRef, spec: svcSpec, hasEnv: env !== undefined, env, source: toSource(change) };
    } else {
      const prev = current?.services[name];
      if (!prev) {
        if (!current) {
          throw new Error(`first deployment of group '${group}' must cover every service — missing '${name}' from this release`);
        }
        throw new Error(`service '${name}' is neither changed by this release nor present in the current combination — add it to the changed set`);
      }
      if (!sameSpec(prev.spec, svcSpec)) {
        throw new Error(`ship.yaml changes the spec of service '${name}' but it is not in this release's changed set — include it in --services; the committed spec stays untouched otherwise`);
      }
      combination[name] = prev; // inherited: keeps its OWN imageRef, spec, env and source
    }
  }
  return { combination, changedServices };
}

export async function runGroupDeploy(appsRoot: string, req: GroupDeployRequest, log: Log): Promise<GroupDeployResult> {
  const spec = validateProjectSpec(req.spec);
  if (spec.name !== req.app) throw new Error(`spec.name '${spec.name}' must equal the group name '${req.app}'`);
  const store = new GroupStore(appsRoot);
  const result = await withDeploySlot(() => withAppLock(req.app, async () => {
    const appDir = store.appDir(req.app);
    await store.assertLayout(req.app);
    // pre-flight ownership of EVERY service project: a foreign same-named
    // project must be refused before this release writes anything
    let hasContainers = false;
    for (const name of Object.keys(spec.services)) {
      const owned = await assertOwnedCompose({ dir: store.servicesDir(req.app, name), project: serviceProject(req.app, name), service: name });
      hasContainers = hasContainers || owned;
    }
    await assertProjectBinding(appDir, { app: req.app, project: req.project, env: req.env }, hasContainers);
    await store.claimLayout(req.app);

    const before = await store.loadState(req.app);
    const current = before.current ? await store.loadRelease(req.app, before.current) : null;
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
        const entry = combination[name];
        if (!entry) throw new Error(`internal: combination entry for '${name}' missing after merge`);
        await pullServiceImage(entry.imageRef, log, pullCtx?.env);
      }
      const switched: string[] = [];
      const fail = async (reason: string): Promise<never> => {
        const ok = await recoverServices({ appsRoot, group: req.app, previousCombination: current?.services ?? null, changedSoFar: switched, log, env: pullCtx?.env });
        throw new GroupDeployFailure(
          `${reason}; recovery of changed services [${switched.join(', ')}] ${current ? 'to the previous combination ' : '(first deploy: removal) '}${ok ? 'succeeded' : 'FAILED — inspect the machine'}`,
          { attempted: true, succeeded: ok, target: current ? switched.map((s) => current.services[s]?.imageRef ?? '').filter(Boolean).join(', ') || null : null },
        );
      };
      try {
        for (const name of changedServices) {
          const entry = combination[name];
          if (!entry) throw new Error(`internal: combination entry for '${name}' missing after merge`);
          await switchService({
            appsRoot, group: req.app, service: name, entry, log, env: pullCtx?.env,
            onBeforeUp: () => { switched.push(name); },
          });
        }
        const changedRefs: Record<string, string> = {};
        let skipped = false;
        for (const name of changedServices) {
          const entry = combination[name];
          if (!entry) throw new Error(`internal: combination entry for '${name}' missing after merge`);
          changedRefs[name] = entry.imageRef;
          const v = await verifyService({ appsRoot, group: req.app, service: name, entry, log });
          if (!v.ok) await fail(`health check failed for changed service '${name}'`);
          if (v.skipped) skipped = true;
        }
        try {
          const { cleanupError } = await store.shift(req.app, release.id, 'deploy');
          if (cleanupError) log(`release snapshot cleanup failed after successful state commit: ${cleanupError}`);
        } catch (e) {
          await fail(`deploy state commit failed: ${(e as Error).message}`);
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
        if (e instanceof GroupDeployFailure) throw e;
        throw await fail(`deploy of [${changedServices.join(', ')}] failed: ${(e as Error).message}`);
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
