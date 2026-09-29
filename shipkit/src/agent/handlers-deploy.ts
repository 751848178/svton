// Deploy/rollback as a transaction over release snapshots (F02/F03/F04/F26):
// prepare(snapshot) → activate(pull+up) → verify(health) → commit(state.shift);
// any failure after the previous release exists triggers full-snapshot recovery.

import { rm } from 'node:fs/promises';
import path from 'node:path';
import { validateSpec } from '../shared/spec-schema.js';
import type { DeployRequest, DeployResult, RollbackRequest } from '../shared/types.js';
import { withAppLock, withDeploySlot } from './app-lock.js';
import { ImageLedger } from './image-ledger.js';
import { ledgerFileFor } from './gc.js';
import { writeFileAtomic } from './atomic.js';
import { COMPOSE_ENV_FILE, explicitHostPort, firstContainerPort, renderComposeFile, writeComposeFile } from './compose.js';
import { compose, composePort, imageExists, pullAuthCtx, type DockerAuthCtx } from './docker.js';
import { waitHealthy } from './healthcheck.js';
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

interface Attempt {
  ok: boolean;
  skipped?: string;
}

async function activate(o: { appDir: string; app: string; release: AppRelease; log: Log; env?: Record<string, string> }): Promise<void> {
  const { app, release, log } = o;
  await writeComposeFile(o.appDir, renderComposeFile(app, release.imageRef, release.spec, release.env !== undefined));
  // runtime env reflects THIS release only (F02); name is not `.env` so it never controls compose (F15)
  const envFile = path.join(o.appDir, 'runtime.env');
  if (release.env !== undefined) {
    await writeFileAtomic(envFile, release.env.endsWith('\n') ? release.env : `${release.env}\n`, 0o600);
  } else {
    await rm(envFile, { force: true });
  }
  await writeFileAtomic(path.join(o.appDir, COMPOSE_ENV_FILE), '');
  // pull policy (F16): digest-pinned refs may reuse a local copy; mutable tags must hit the registry first
  const immutable = /@sha256:[0-9a-f]{64}$/.test(release.imageRef);
  if (immutable && (await imageExists(release.imageRef))) {
    log(`image ${release.imageRef} present locally (digest-pinned) — skipping pull`);
  } else {
    try {
      await compose({ appDir: o.appDir, app, args: ['pull'], log, env: o.env });
    } catch (e) {
      if (await imageExists(release.imageRef)) {
        log(`registry pull failed — falling back to local ${release.imageRef} (tag may be stale)`);
      } else {
        throw e;
      }
    }
  }
  await compose({ appDir: o.appDir, app, args: ['up', '-d', '--remove-orphans'], log, env: o.env });
}

async function verify(o: { appDir: string; app: string; release: AppRelease; log: Log }): Promise<Attempt> {
  const spec = o.release.spec;
  let hostPort = explicitHostPort(spec);
  if (!hostPort && spec.healthcheck?.path) {
    const cp = firstContainerPort(spec);
    if (cp) hostPort = await composePort({ appDir: o.appDir, app: o.app, service: o.app, containerPort: cp }) ?? undefined;
  }
  if (!hostPort || !spec.healthcheck?.path) {
    o.log('no healthcheck resolvable — post-deploy verification SKIPPED');
    return { ok: true, skipped: 'verification skipped: no healthcheck/port resolvable' };
  }
  const url = `http://127.0.0.1:${hostPort}${spec.healthcheck.path}`;
  const outcome = await waitHealthy({ url, timeoutMs: (spec.healthcheck.timeoutSeconds ?? 120) * 1000, log: o.log });
  return outcome.healthy ? { ok: true } : { ok: false };
}

async function attempt(o: { appDir: string; app: string; release: AppRelease; log: Log; env?: Record<string, string> }): Promise<Attempt> {
  try {
    await activate(o);
    return await verify(o);
  } catch (e) {
    o.log(`activation failed: ${(e as Error).message}`);
    return { ok: false };
  }
}

export async function runDeploy(appsRoot: string, req: DeployRequest, log: Log): Promise<DeployResult> {
  const spec = validateSpec(req.spec);
  const app = req.app;
  const store = new ReleaseStore(appsRoot);
  const result: DeployResult = await withDeploySlot(() => withAppLock(app, async () => {
    const appDir = store.appDir(app);
    const before = await store.loadState(app);
    const release = await store.saveRelease(
      app,
      req.imageRef,
      spec,
      typeof req.envFileContent === 'string' ? req.envFileContent : undefined,
    );
    const pullCtx: DockerAuthCtx | null = await pullAuthCtx(req.imageRef, log).catch((e: unknown) => {
      log(`pull login failed: ${(e as Error).message}`);
      return null;
    });
    try {
      const outcome = await attempt({ appDir, app, release, log, env: pullCtx?.env });
      if (!outcome.ok) {
        if (before.current) {
          const prev = await store.loadRelease(app, before.current);
          log(`deploy failed — recovering full previous release ${prev.id} (${prev.imageRef})`);
          const rec = await attempt({ appDir, app, release: prev, log, env: pullCtx?.env });
          throw new DeployFailure(
            `deploy of ${release.imageRef} failed; recovery to ${prev.imageRef} ${rec.ok ? 'succeeded' : 'FAILED'}`,
            { attempted: true, succeeded: rec.ok, target: prev.imageRef },
          );
        }
        throw new DeployFailure(`deploy of ${release.imageRef} failed and no previous release exists to recover to`, {
          attempted: true,
          succeeded: false,
          target: null,
        });
      }
      await store.shift(app, release.id, 'deploy');
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
    const appDir = store.appDir(app);
    log(`rolling back ${app} to release ${target.id} (${target.imageRef})`);
    const pullCtx = await pullAuthCtx(target.imageRef, log).catch(() => null);
    try {
      const outcome = await attempt({ appDir, app, release: target, log, env: pullCtx?.env });
      if (!outcome.ok) {
        throw new DeployFailure(`rollback to ${target.imageRef} failed activation/health`, {
          attempted: true,
          succeeded: false,
          target: target.imageRef,
        });
      }
      await store.shift(app, target.id, 'rollback');
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
