// Docker / docker-compose wrappers (F26 real port mapping, F35 per-job docker config, F25 absolute -f paths).

import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { exec, type ExecOptions } from '../shared/exec.js';
import { COMPOSE_ENV_FILE } from './compose.js';

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
  if (r.code !== 0) throw new Error(`${cmd} ${args.join(' ')} failed (exit ${r.code})`);
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
  log: Log;
}): Promise<string> {
  const args = ['build', '--progress=plain'];
  for (const [k, v] of Object.entries(o.buildArgs)) args.push('--build-arg', `${k}=${v}`);
  args.push('-f', o.dockerfileAbs, '-t', o.tag, o.contextDir);
  await must('docker', args, { cwd: o.repoDir, timeoutMs: 60 * 60_000, log: o.log });
  const inspect = await exec('docker', ['image', 'inspect', o.tag, '--format', '{{.Id}}'], { timeoutMs: 15_000 });
  return inspect.code === 0 ? inspect.stdout.trim() : o.tag;
}

/** login → retag → push, all inside a private DOCKER_CONFIG; logout awaited before cleanup (F35). */
export async function dockerPushAsImageRef(o: {
  localImage: string;
  imageRef: string;
  registry: string;
  log: Log;
}): Promise<{ digest?: string }> {
  const user = requireEnv('SHIP_PUSH_USER');
  const password = requireEnv('SHIP_PUSH_PASSWORD');
  const ctx = await authCtx();
  try {
    await must('docker', ['login', o.registry, '-u', user, '--password-stdin'], {
      timeoutMs: 30_000, log: o.log, stdin: password, env: ctx.env,
    });
    await must('docker', ['tag', o.localImage, o.imageRef], { timeoutMs: 30_000, log: o.log, env: ctx.env });
    const push = await must('docker', ['push', o.imageRef], { timeoutMs: 60 * 60_000, log: o.log, env: ctx.env });
    const digest = /digest:\s*(sha256:[0-9a-f]{64})/.exec(`${push.stdout}\n${push.stderr}`)?.[1];
    return { digest };
  } finally {
    await exec('docker', ['logout', o.registry], { timeoutMs: 30_000, env: ctx.env });
    await ctx.cleanup();
  }
}

/** pull-side login for private registries; returns null when not configured (F21/F35). */
export async function pullAuthCtx(imageRef: string, log: Log): Promise<DockerAuthCtx | null> {
  const user = process.env.SHIP_PULL_USER;
  const password = process.env.SHIP_PULL_PASSWORD;
  if (!user || !password) return null;
  const host = imageRef.split('/')[0] ?? '';
  if (!/[.:]/.test(host)) return null;
  const ctx = await authCtx();
  await must('docker', ['login', host, '-u', user, '--password-stdin'], {
    timeoutMs: 30_000, log, stdin: password, env: ctx.env,
  });
  return ctx;
}

export async function imageExists(imageRef: string): Promise<boolean> {
  const r = await exec('docker', ['image', 'inspect', imageRef, '--format', '{{.Id}}'], { timeoutMs: 15_000 });
  return r.code === 0;
}

export interface ComposeOpts {
  appDir: string;
  app: string;
  args: string[];
  log: Log;
  timeoutMs?: number;
  env?: Record<string, string>;
}

/** compose is always pinned: explicit project name + isolated --env-file (F15). */
export async function compose(o: ComposeOpts): Promise<void> {
  await must('docker', ['compose', '-p', `ship-${o.app}`, '--env-file', COMPOSE_ENV_FILE, '-f', 'compose.yaml', ...o.args], {
    cwd: o.appDir, timeoutMs: o.timeoutMs ?? 15 * 60_000, log: o.log, env: o.env,
  });
}

/** actual published host port for a container port (dynamic mappings, F26); null when unpublished. */
export async function composePort(o: { appDir: string; app: string; service: string; containerPort: number }): Promise<number | null> {
  const r = await exec('docker', [
    'compose', '-p', `ship-${o.app}`, '--env-file', COMPOSE_ENV_FILE, '-f', 'compose.yaml',
    'port', o.service, String(o.containerPort),
  ], { cwd: o.appDir, timeoutMs: 20_000 });
  const m = /:(\d{2,5})\s*$/.exec(r.stdout.trim());
  return m ? Number(m[1]) : null;
}
