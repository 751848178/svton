// Docker / docker-compose wrappers (F26 real port mapping, F35 per-job docker config, F25 absolute -f paths).

import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { exec, type ExecOptions } from '../shared/exec.js';
import { COMPOSE_ENV_FILE } from './compose.js';
import { assertOwnedCompose } from './compose-ownership.js';
import { resolveBuildPaths } from './build-paths.js';

type Log = (line: string) => void;

interface MustOptions extends ExecOptions {
  log: Log;
}

/** per-job docker config dir: login state never shared, never leaks to the machine default (F35) */
export interface DockerAuthCtx {
  env: Record<string, string>;
  cleanup(): Promise<void>;
}

export async function dockerAvailable(): Promise<boolean> {
  const r = await exec('docker', ['version', '--format', '{{.Server.Version}}'], { timeoutMs: 10_000 });
  return r.code === 0;
}

export function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`missing required agent env ${name}`);
  return v;
}

async function must(cmd: string, args: string[], opts: MustOptions): Promise<{ stdout: string; stderr: string }> {
  const r = await exec(cmd, args, { ...opts, onLine: (l) => opts.log(l) });
  if (r.code !== 0) {
    // stderr tail travels with the error so failures stay classifiable (401/403/dns/tls)
    throw new Error(`${cmd} ${args.join(' ')} failed (exit ${r.code}): ${r.stderr.slice(0, 240)}`);
  }
  return r;
}

async function authCtx(): Promise<DockerAuthCtx> {
  const dir = await mkdtemp(path.join(tmpdir(), 'ship-dockercfg-'));
  return {
    env: { DOCKER_CONFIG: dir },
    cleanup: () => rm(dir, { recursive: true, force: true }),
  };
}

export async function dockerBuild(o: {
  repoDir: string;
  contextDir: string;
  dockerfileAbs: string;
  buildArgs: Record<string, string>;
  tag: string;
  /** explicit Dockerfile build target (multi-stage) */
  target?: string;
  /** explicit image platform, e.g. linux/amd64 (cross-build via emulation) */
  platform?: string;
  log: Log;
}): Promise<{ imageId: string; arch?: string }> {
  const paths = await resolveBuildPaths(o.repoDir, o.contextDir, o.dockerfileAbs);
  const args = ['build', '--progress=plain'];
  if (o.target) args.push('--target', o.target);
  if (o.platform) args.push('--platform', o.platform);
  for (const [k, v] of Object.entries(o.buildArgs)) args.push('--build-arg', `${k}=${v}`);
  args.push('-f', paths.dockerfileAbs, '-t', o.tag, paths.contextDir);
  await must('docker', args, { cwd: paths.repoDir, timeoutMs: 60 * 60_000, log: o.log });
  const inspect = await exec('docker', ['image', 'inspect', o.tag, '--format', '{{.Id}}\t{{.Os}}/{{.Architecture}}'], { timeoutMs: 15_000 });
  if (inspect.code !== 0) return { imageId: o.tag };
  const [imageId, arch] = inspect.stdout.trim().split('\t');
  return { imageId: imageId || o.tag, arch };
}

/** login → retag → push, all inside a private DOCKER_CONFIG; logout awaited before cleanup (F35).
 *  Credentials are passed in by the caller (env bootstrap or the API-distributed file). */
export async function dockerPushAsImageRef(o: {
  localImage: string;
  imageRef: string;
  registry: string;
  /** null = anonymous registry: skip login; a 401 then surfaces with its real reason */
  creds: { user: string; password: string } | null;
  log: Log;
}): Promise<{ digest?: string }> {
  const ctx = await authCtx();
  try {
    if (o.creds) {
      await must('docker', ['login', o.registry, '-u', o.creds.user, '--password-stdin'], {
        timeoutMs: 30_000, log: o.log, stdin: o.creds.password, env: ctx.env,
      });
    }
    await must('docker', ['tag', o.localImage, o.imageRef], { timeoutMs: 30_000, log: o.log, env: ctx.env });
    const push = await must('docker', ['push', o.imageRef], { timeoutMs: 60 * 60_000, log: o.log, env: ctx.env });
    const digest = /digest:\s*(sha256:[0-9a-f]{64})/.exec(`${push.stdout}\n${push.stderr}`)?.[1];
    return { digest };
  } finally {
    if (o.creds) await exec('docker', ['logout', o.registry], { timeoutMs: 30_000, env: ctx.env });
    await ctx.cleanup();
  }
}

/** pull-side login for private registries; returns null when not configured (F21/F35).
 *  creds = resolved by the caller (env first, then the API-distributed file); null = anonymous. */
export async function pullAuthCtx(imageRef: string, log: Log, creds?: { user: string; password: string } | null): Promise<DockerAuthCtx | null> {
  const user = creds?.user;
  const password = creds?.password;
  if (!user || !password) return null;
  const host = imageRef.split('/')[0] ?? '';
  if (!/[.:]/.test(host)) return null;
  const ctx = await authCtx();
  try {
    await must('docker', ['login', host, '-u', user, '--password-stdin'], {
      timeoutMs: 30_000, log, stdin: password, env: ctx.env,
    });
    return ctx;
  } catch (e) {
    await ctx.cleanup();
    throw e;
  }
}

export async function imageExists(imageRef: string): Promise<boolean> {
  const r = await exec('docker', ['image', 'inspect', imageRef, '--format', '{{.Id}}'], { timeoutMs: 15_000 });
  return r.code === 0;
}

/** pull one image ref directly (independent of any compose file) so ALL changed
 *  images can land BEFORE the first container switches (MS-04); digest-pinned
 *  refs may reuse a local copy, mutable tags must hit the registry first (F16) */
export async function dockerPullImage(o: { imageRef: string; log: Log; env?: Record<string, string> }): Promise<void> {
  const immutable = /@sha256:[0-9a-f]{64}$/.test(o.imageRef);
  if (immutable && (await imageExists(o.imageRef))) {
    o.log(`image ${o.imageRef} present locally (digest-pinned) — skipping pull`);
    return;
  }
  try {
    await must('docker', ['pull', o.imageRef], { timeoutMs: 30 * 60_000, log: o.log, env: o.env });
  } catch (e) {
    if (await imageExists(o.imageRef)) {
      o.log(`registry pull failed — falling back to local ${o.imageRef} (tag may be stale)`);
    } else {
      throw e;
    }
  }
}

export interface ComposeOpts {
  appDir: string;
  app: string;
  args: string[];
  log: Log;
  timeoutMs?: number;
  env?: Record<string, string>;
  /** explicit compose project (defaults to composeProject(app)); v2 groups
   *  pass their per-service project ship_<group>_<service> */
  project?: string;
}

/** the compose project pinned for an app (F15) — this identity must be
 *  VERIFIED as ours before deploy/rollback modifies anything */
export const composeProject = (app: string): string => `ship-${app}`;

/** compose is always pinned: explicit project name + isolated --env-file (F15). */
export async function compose(o: ComposeOpts): Promise<void> {
  await must('docker', ['compose', '-p', o.project ?? composeProject(o.app), '--env-file', COMPOSE_ENV_FILE, '-f', 'compose.yaml', ...o.args], {
    cwd: o.appDir, timeoutMs: o.timeoutMs ?? 15 * 60_000, log: o.log, env: { ...o.env, COMPOSE_REMOVE_ORPHANS: 'false' },
  });
}

/** v1 wrapper over the generalized ownership check (compose-ownership.ts) */
export async function assertComposeOwnership(o: { appDir: string; app: string }): Promise<boolean> {
  return assertOwnedCompose({ dir: o.appDir, project: composeProject(o.app), service: o.app });
}

/** actual published host port for a container port (dynamic mappings, F26); null when unpublished. */
export async function composePort(o: { appDir: string; app: string; service: string; containerPort: number; project?: string }): Promise<number | null> {
  const r = await exec('docker', [
    'compose', '-p', o.project ?? composeProject(o.app), '--env-file', COMPOSE_ENV_FILE, '-f', 'compose.yaml',
    'port', o.service, String(o.containerPort),
  ], { cwd: o.appDir, timeoutMs: 20_000 });
  const m = /:(\d{2,5})\s*$/.exec(r.stdout.trim());
  return m ? Number(m[1]) : null;
}
