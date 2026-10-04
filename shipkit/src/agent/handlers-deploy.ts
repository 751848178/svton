// Deploy/rollback as a transaction over release snapshots (F02/F03/F04/F26):
// prepare(snapshot) → activate(pull+up) → verify(health) → commit(state.shift);
// any failure after the previous release exists triggers full-snapshot recovery.

import path from 'node:path';
import { validateSpec } from '../shared/spec-schema.js';
import type { DeployRequest, DeployResult, RollbackRequest } from '../shared/types.js';
import { withAppLock, withDeploySlot } from './app-lock.js';
import { ImageLedger } from './image-ledger.js';
import { ledgerFileFor } from './gc.js';
import { assertProjectBinding } from './project-binding.js';
import { assertComposeOwnership, pullAuthCtx, type DockerAuthCtx } from './docker.js';
import { resolvePullCreds } from './registry-creds.js';
import { attempt } from './deployment-activation.js';
import type { JobContext } from './jobs.js';
import { ReleaseStore, type AppRelease } from './release.js';

type Log = JobContext['log'];

export class DeployFailure extends Error {
  constructor(
    message: string,
    readonly recovery: { attempted: true; succeeded: boolean; target: string | null },
  ) {
    super(message);
  }
}

type Activation = Parameters<typeof attempt>[0];

async function recover(o: Activation, previous: AppRelease | null, reason: string): Promise<never> {
  if (previous) o.log(`${reason} — recovering full previous release ${previous.id} (${previous.imageRef})`);
  const result = previous ? await attempt({ ...o, release: previous }) : null;
  throw new DeployFailure(
    `${reason}; ${previous ? `recovery to ${previous.imageRef} ${result?.ok ? 'succeeded' : 'FAILED'}` : 'no previous release exists to recover to'}`,
    { attempted: true, succeeded: result?.ok ?? false, target: previous?.imageRef ?? null },
  );
}

async function commit(store: ReleaseStore, o: Activation, previous: AppRelease | null, event: 'deploy' | 'rollback'): Promise<void> {
  let cleanupError: string | undefined;
  try {
    ({ cleanupError } = await store.shift(o.app, o.release.id, event));
  } catch (e) {
    // Activation changed the running app but state still names the previous
    // release. Restore that snapshot before reporting this failed transaction.
    await recover(o, previous, `${event} state commit failed: ${(e as Error).message}`);
  }
  if (cleanupError) o.log(`release snapshot cleanup failed after successful state commit: ${cleanupError}`);
}

export async function runDeploy(appsRoot: string, req: DeployRequest, log: Log): Promise<DeployResult> {
  const spec = validateSpec(req.spec);
  const app = req.app;
  const store = new ReleaseStore(appsRoot);
  const result: DeployResult = await withDeploySlot(() => withAppLock(app, async () => {
    const appDir = store.appDir(app);
    // a same-named project/container owned by ANOTHER deployment (another
    // environment, repo or an external actor) must be refused BEFORE this
    // deployment writes or modifies anything
    const hasContainers = await assertComposeOwnership({ appDir, app });
    await assertProjectBinding(appDir, { app, project: req.project, env: req.env }, hasContainers);
    const before = await store.loadState(app);
    // Validate the recovery snapshot before touching the running release;
    // --keep-env copies that committed environment into this new snapshot.
    const previous = before.current ? await store.loadRelease(app, before.current) : null;
    if (req.keepEnv && req.envFileContent === undefined && !previous) {
      throw new Error('--keep-env requires a current successful release; restore its state or provide --env-file explicitly');
    }
    const release = await store.saveRelease(
      app,
      req.imageRef,
      spec,
      typeof req.envFileContent === 'string' ? req.envFileContent : req.keepEnv ? previous?.env : undefined,
    );
    const pullCreds = await resolvePullCreds(path.dirname(appsRoot));
    const pullCtx: DockerAuthCtx | null = await pullAuthCtx(req.imageRef, log, pullCreds).catch((e: unknown) => {
      log(`pull login failed: ${(e as Error).message}`);
      return null;
    });
    try {
      const activation = { appDir, app, release, identity: req, log, env: pullCtx?.env };
      const outcome = await attempt(activation);
      if (!outcome.ok) await recover(activation, previous, `deploy of ${release.imageRef} failed`);
      await commit(store, activation, previous, 'deploy');
      return {
        app,
        imageRef: release.imageRef,
        releaseId: release.id,
        previousReleaseId: before.current,
        verification: outcome.skipped ? 'skipped' : 'passed',
      };
    } finally {
      await pullCtx?.cleanup();
    }
  }));
  // record the managed image for future GC (best-effort; never blocks a deploy)
  await new ImageLedger(ledgerFileFor(appsRoot)).record(result.imageRef, app).catch((e: unknown) => log(`image ledger record failed: ${(e as Error).message}`));
  return result;
}

export async function runRollback(appsRoot: string, req: RollbackRequest, log: Log): Promise<DeployResult> {
  const app = req.app;
  const store = new ReleaseStore(appsRoot);
  const result: DeployResult = await withDeploySlot(() => withAppLock(app, async () => {
    const state = await store.loadState(app);
    if (!state.previous) throw new Error(`app '${app}' has no previous release to roll back to`);
    const target = await store.loadRelease(app, state.previous);
    const current = state.current ? await store.loadRelease(app, state.current) : null;
    const appDir = store.appDir(app);
    // rollback mutates the same resources — verify ownership first, refuse on
    // any foreign same-named project/container before touching anything
    const hasContainers = await assertComposeOwnership({ appDir, app });
    await assertProjectBinding(appDir, { app, project: req.project, env: req.env }, hasContainers);
    log(`rolling back ${app} to release ${target.id} (${target.imageRef})`);
    const pullCtx = await pullAuthCtx(target.imageRef, log, await resolvePullCreds(path.dirname(appsRoot))).catch(() => null);
    try {
      const activation = { appDir, app, release: target, identity: req, log, env: pullCtx?.env };
      const outcome = await attempt(activation);
      if (!outcome.ok) {
        throw new DeployFailure(`rollback to ${target.imageRef} failed activation/health`, {
          attempted: true,
          succeeded: false,
          target: target.imageRef,
        });
      }
      await commit(store, activation, current, 'rollback');
      return {
        app,
        imageRef: target.imageRef,
        releaseId: target.id,
        previousReleaseId: state.current,
        verification: outcome.skipped ? 'skipped' : 'passed',
      };
    } finally {
      await pullCtx?.cleanup();
    }
  }));
  await new ImageLedger(ledgerFileFor(appsRoot)).record(result.imageRef, app).catch((e: unknown) => log(`image ledger record failed: ${(e as Error).message}`));
  return result;
}
