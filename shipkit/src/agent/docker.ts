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
  log: Log;
}): Promise<string> {
  const args = ['build', '--progress=plain'];
  for (const [k, v] of Object.entries(o.buildArgs)) args.push('--build-arg', `${k}=${v}`);
  args.push('-f', o.dockerfileAbs, '-t', o.tag, o.contextDir);
  await must('docker', args, { cwd: o.repoDir, timeoutMs: 60 * 60_000, log: o.log });
  const inspect = await exec('docker', ['image', 'inspect', o.tag, '--format', '{{.Id}}'], { timeoutMs: 15_000 });
  return inspect.code === 0 ? inspect.stdout.trim() : o.tag;
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

/** the compose project pinned for an app (F15) — this identity must be
 *  VERIFIED as ours before deploy/rollback modifies anything */
export const composeProject = (app: string): string => `ship-${app}`;

/** compose is always pinned: explicit project name + isolated --env-file (F15). */
export async function compose(o: ComposeOpts): Promise<void> {
  await must('docker', ['compose', '-p', composeProject(o.app), '--env-file', COMPOSE_ENV_FILE, '-f', 'compose.yaml', ...o.args], {
    cwd: o.appDir, timeoutMs: o.timeoutMs ?? 15 * 60_000, log: o.log, env: { ...o.env, COMPOSE_REMOVE_ORPHANS: 'false' },
  });
}

/** REFUSE to operate when a same-named compose project or container is NOT
 *  owned by THIS deployment. Every existing container of the app's project —
 *  plus any container occupying the project's derived names without our
 *  label — must carry the compose working_dir label of THIS appDir (the
 *  deployment identity; another environment/repo on the same machine has a
 *  different appDir). Strictly read-only: inspects, never stops, removes or
 *  deletes anything; docker errors fail CLOSED (no verification ⇒ no
 *  modification). Callers run this BEFORE any mutating step. */
export async function assertComposeOwnership(o: { appDir: string; app: string }): Promise<boolean> {
  const project = composeProject(o.app);
  const fail = (why: string): Error => new Error(`无法核验 compose 项目 ${project} 的资源归属（${why}）— 拒绝执行`);
  const labeled = await exec('docker', ['ps', '-a', '--filter', `label=com.docker.compose.project=${project}`, '--format', '{{.ID}}'], { timeoutMs: 20_000 });
  if (labeled.code !== 0 || labeled.truncated || labeled.timedOut) throw fail('docker ps 按项目标签过滤失败或结果不完整');
  const all = await exec('docker', ['ps', '-a', '--format', '{{.ID}}\t{{.Names}}'], { timeoutMs: 20_000 });
  if (all.code !== 0 || all.truncated || all.timedOut) throw fail('docker ps 列出同名容器失败或结果不完整');
  const ids = new Set(labeled.stdout.split('\n').map((l) => l.trim()).filter(Boolean));
  // EXACT derived-name match (compose v2 `<project>-<service>-<n>`, legacy v1
  // `<project>_<service>_n`; service === app): a prefix test would swallow a
  // sibling app like `web` matching `ship-web-api-web-api-1`
  const esc = o.app.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const derivedName = new RegExp(`^${project}-${esc}-\\d+$|^${project}_${esc}_\\d+$`);
  for (const line of all.stdout.split('\n')) {
    const [id, name] = line.trim().split('\t');
    if (id && derivedName.test(name ?? '')) ids.add(id); // name squatter (may lack our label)
  }
  if (!ids.size) return false;
  const inspect = await exec('docker', ['inspect', '--format',
    '{{.Name}}\t{{index .Config.Labels "com.docker.compose.project"}}\t{{index .Config.Labels "com.docker.compose.project.working_dir"}}',
    ...ids], { timeoutMs: 20_000 });
  if (inspect.code !== 0 || inspect.truncated || inspect.timedOut) throw fail('docker inspect 失败或结果不完整');
  const rows = inspect.stdout.split('\n').filter((line) => line.trim());
  if (rows.length !== ids.size) throw fail('docker inspect 未返回全部容器的归属');
  const mine = path.resolve(o.appDir);
  for (const line of rows) {
    const [name, labelProject, workingDir] = line.trim().split('\t');
    if (!name) continue;
    const owner = (workingDir ?? '').trim();
    if (labelProject !== project || !owner || path.resolve(owner) !== mine) {
      throw new Error(
        `拒绝执行：容器 ${name}（compose 项目 ${labelProject || project}）属于其他部署（工作目录 ${owner || '未知'}，本次部署为 ${mine}）— ` +
        '同名资源不属于当前部署；请人工处理该环境或为应用更名',
      );
    }
  }
  return true; // existing containers are deployment evidence even if local state was lost
}

/** actual published host port for a container port (dynamic mappings, F26); null when unpublished. */
export async function composePort(o: { appDir: string; app: string; service: string; containerPort: number }): Promise<number | null> {
  const r = await exec('docker', [
    'compose', '-p', composeProject(o.app), '--env-file', COMPOSE_ENV_FILE, '-f', 'compose.yaml',
    'port', o.service, String(o.containerPort),
  ], { cwd: o.appDir, timeoutMs: 20_000 });
  const m = /:(\d{2,5})\s*$/.exec(r.stdout.trim());
  return m ? Number(m[1]) : null;
}
