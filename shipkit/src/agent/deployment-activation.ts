// Activation and health verification shared by deploy, rollback and recovery.
import { rm } from 'node:fs/promises';
import path from 'node:path';
import { writeFileAtomic } from './atomic.js';
import { assertProjectBinding, type BindingRequest } from './project-binding.js';
import { COMPOSE_ENV_FILE, explicitHostPort, firstContainerPort, renderComposeFile, writeComposeFile } from './compose.js';
import { assertComposeOwnership, compose, composePort, imageExists } from './docker.js';
import { waitHealthy } from './healthcheck.js';
import type { JobContext } from './jobs.js';
import type { AppRelease } from './release.js';

type Log = JobContext['log'];
interface Activation {
  appDir: string;
  app: string;
  release: AppRelease;
  identity: BindingRequest;
  log: Log;
  env?: Record<string, string>;
}

interface Attempt {
  ok: boolean;
  skipped?: string;
}

async function activate(o: Activation): Promise<void> {
  const { app, release, log } = o;
  await assertProjectBinding(o.appDir, o.identity, false, false);
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
  // RE-VERIFY ownership immediately before the only mutating step: the
  // pre-flight gate ran before any state was written, but the (potentially
  // long) pull window allows a foreign actor to take the project over — that
  // must be caught here, not discovered after `up` adopted their resources.
  // Same check covers deploy, manual rollback and failure auto-recovery —
  // every real activation goes through this function. No --remove-orphans:
  // we never clean resources that are not verifiably ours.
  await assertComposeOwnership({ appDir: o.appDir, app });
  await assertProjectBinding(o.appDir, o.identity, false, false);
  await compose({ appDir: o.appDir, app, args: ['up', '-d'], log, env: o.env });
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

export async function attempt(o: Activation): Promise<Attempt> {
  try {
    await activate(o);
    return await verify(o);
  } catch (e) {
    o.log(`activation failed: ${(e as Error).message}`);
    return { ok: false };
  }
}
