// Build/deploy orchestration (F01 binding, F06 tar excludes, F12 finally-release, F16 digest pinning,
// F20 keep-window semantics, F32 env contract, F04/F28 recovery-aware exit codes).

import { existsSync, readFileSync } from 'node:fs';
import { readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { loadSpecAt } from '../shared/spec-load.js';
import { gitHeadSha, gitRemote } from '../shared/git.js';
import { exec } from '../shared/exec.js';
import { api, apiUpload, fetchLogTail, waitForJob } from '../shared/http.js';
import type { Logger } from '../shared/log.js';
import type { BuildResult, BuildSource, DeployResult, Job, PushResult, ShipConfig, ShipSpec } from '../shared/types.js';
import { createBuilderProvider } from '../providers/registry.js';
import { sweepExpiredBuilders } from '../providers/tencent-client.js';
import type { BuilderHandle } from '../providers/provider.js';
import { CliError } from './errors.js';
import { readLastBuild, saveLastBuild } from './local-state.js';
import { resolveTarget } from './targets.js';
import { waitAndReport } from './job-report.js';

export function minutesArg(v: string | undefined, def: number): number {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n * 60_000 : def * 60_000;
}

async function resolveGitSource(cwd: string, config: ShipConfig, log: Logger): Promise<BuildSource> {
  const repo = config.source?.repo ?? (await gitRemote(cwd));
  if (!repo) throw new CliError('no git origin remote and no config.source.repo — run inside the project repo or set source.repo');
  const ref = config.source?.ref ?? (await gitHeadSha(cwd)) ?? 'HEAD';
  log.info('build source', { repo, ref, auth: config.source?.token ? 'token' : 'none' });
  return { type: 'git', repo, ref, token: config.source?.token };
}

/** secrets and controller config must never enter the builder via --from-dir (F06) */
const DEFAULT_SOURCE_EXCLUDES = ['.git', 'node_modules', '.env', 'deploy.env', '*.pem', 'ship.config.yaml', 'ship.config.yml', 'ship.config.json'];

async function uploadTarballSource(handle: BuilderHandle, fromDir: string, spec: ShipSpec, log: Logger): Promise<BuildSource> {
  const tgz = path.join(tmpdir(), `ship-src-${Date.now()}.tgz`);
  const args = ['czf', tgz, '-C', fromDir];
  const excludes = [...new Set([...DEFAULT_SOURCE_EXCLUDES, spec.envFile ?? ''])].filter(Boolean);
  for (const x of excludes) args.push(`--exclude=${x}`);
  const r = await exec('tar', args, { timeoutMs: 10 * 60_000 });
  if (r.code !== 0) throw new CliError(`packing source dir failed: ${r.stderr.slice(0, 300)}`);
  try {
    const bytes = await readFile(tgz);
    if (bytes.length > 500 * 1024 * 1024) throw new CliError(`source tarball is ${Math.round(bytes.length / 1048576)}MB (limit 500MB)`);
    log.info('uploading source tarball', { bytes: bytes.length, from: fromDir, excludes });
    const { id } = await apiUpload(handle.url, handle.token, bytes);
    return { type: 'tarball', id };
  } finally {
    await rm(tgz, { force: true });
  }
}

/** deployments bind to the pushed digest so mutable tags can never resolve to a stale image (F16) */
function digestRef(imageRef: string, digest?: string): string {
  if (!digest) return imageRef;
  const base = imageRef.replace(/:[^/:]+$/, '');
  return `${base}@${digest}`;
}

export interface BuildOutcome {
  spec: ShipSpec;
  build: BuildResult;
  push: PushResult;
  /** what deploy should use: digest-pinned when the digest is known */
  imageRef: string;
  builderUrl: string;
}

export async function runBuildPipeline(o: {
  config: ShipConfig;
  cwd: string;
  logger: Logger;
  fromDir?: string;
  tag?: string;
  keepBuilder?: boolean;
  timeoutMs: number;
}): Promise<BuildOutcome> {
  const log = o.logger;
  const spec = loadSpecAt(o.cwd);
  if (!o.config.registry) throw new CliError('config.registry (url + namespace) is required to push images');
  const registry = o.config.registry;
  await sweepExpiredBuilders((m, meta) => log.info(m, meta));
  const provider = await createBuilderProvider(o.config);
  const reuseWindow = o.config.builder.dynamic?.keepMinutes ?? 0;
  const keep = o.keepBuilder || reuseWindow > 0;
  // the FULL task budget: build wait + push wait + upload/overhead (RA03)
  const taskBudgetMs = o.timeoutMs * 2 + 15 * 60_000;
  const runTask = async (handle: BuilderHandle): Promise<BuildOutcome> => {
    const source = o.fromDir
      ? await uploadTarballSource(handle, o.fromDir, spec, log)
      : await resolveGitSource(o.cwd, o.config, log);
    const started = await api<{ jobId: string }>(handle.url, handle.token, 'POST', '/api/build', { source, spec, tag: o.tag });
    const buildJob = await waitAndReport(handle, started.jobId, 'build', log, o.timeoutMs);
    const build = buildJob.result as BuildResult;

    const pushed = await api<{ jobId: string }>(handle.url, handle.token, 'POST', '/api/push', {
      name: spec.name,
      tag: build.tag,
      registry: registry.url,
      namespace: registry.namespace,
    });
    const pushJob = await waitAndReport(handle, pushed.jobId, 'push', log, o.timeoutMs);
    const push = pushJob.result as PushResult;

    const imageRef = digestRef(push.imageRef, push.digest);
    await saveLastBuild({ app: spec.name, imageRef, tag: build.tag, digest: push.digest, at: new Date().toISOString(), builderUrl: handle.url });
    return { spec, build, push, imageRef, builderUrl: handle.url };
  };
  try {
    // leased execution: another CLI cannot destroy this machine mid-task (RA04)
    if (provider.runExclusive) return await provider.runExclusive((m, meta) => log.info(m, meta), taskBudgetMs, runTask);
    return await runTask(await provider.ensure((m, meta) => log.info(m, meta), taskBudgetMs));
  } finally {
    // release on EVERY exit path (success and failure) unless a reuse window / flag asked to keep (F12/F20)
    if (o.config.builder.mode === 'dynamic') {
      if (keep) {
        log.info('dynamic builder kept for reuse — release it with `ship builder down`');
      } else {
        log.info('releasing dynamic builder');
        await provider.release().catch((e: unknown) => log.warn('builder release failed — run `ship builder down`', { error: String(e) }));
      }
    }
  }
}

export async function runDeployPipeline(o: {
  config: ShipConfig;
  cwd: string;
  logger: Logger;
  app?: string;
  imageRef?: string;
  envFile?: string;
  keepEnv?: boolean;
  targetName?: string;
  timeoutMs: number;
}): Promise<DeployResult & { target: string }> {
  const log = o.logger;
  const spec = loadSpecAt(o.cwd);
  const app = o.app ?? spec.name;
  const imageRef = o.imageRef ?? (await readLastBuild(app))?.imageRef;
  if (!imageRef) {
    throw new CliError(`no imageRef for app '${app}' — pass --ref or run \`ship build\` from this project first`);
  }

  const { name, target } = resolveTarget(o.config, o.targetName);

  // env contract (F32): an explicit or declared env file must exist; --keep-env opts out explicitly
  let envFileContent: string | undefined;
  if (o.envFile) {
    const abs = path.resolve(o.cwd, o.envFile);
    if (!existsSync(abs)) throw new CliError(`--env-file not found: ${o.envFile}`);
    envFileContent = readFileSync(abs, 'utf8');
  } else if (spec.envFile && !o.keepEnv) {
    const abs = path.resolve(o.cwd, spec.envFile);
    if (!existsSync(abs)) {
      throw new CliError(`spec.envFile '${spec.envFile}' not found — create it, or pass --keep-env to reuse the env already on the server`);
    }
    envFileContent = readFileSync(abs, 'utf8');
  }
  if (envFileContent !== undefined) log.info('attaching runtime env file', { redacted: true });

  log.info('deploying', { app, imageRef, target: name });
  const started = await api<{ jobId: string }>(target.url, target.token, 'POST', '/api/deploy', { app, imageRef, spec, envFileContent });
  const job = await waitAndReport({ url: target.url, token: target.token }, started.jobId, 'deploy', log, o.timeoutMs);
  const result = job.result as DeployResult;
  return { ...result, target: name };
}
