// Build/deploy orchestration (F01 binding, F06 tar excludes, F12 finally-release, F16 digest pinning,
// F20 keep-window semantics, F32 env contract, F04/F28 recovery-aware exit codes).

import { existsSync, readFileSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { loadSpecAt } from '../shared/spec-load.js';
import { gitHeadSha, gitRemote } from '../shared/git.js';
import { publicGitRepoUrl } from '../shared/git-url.js';
import { exec } from '../shared/exec.js';
import { api, apiUpload, fetchLogTail, waitForJob } from '../shared/http.js';
import type { Logger } from '../shared/log.js';
import type { BuildResult, BuildSource, DeployResult, Job, PushResult, ShipConfig, ShipSpec } from '../shared/types.js';
import type { BuilderHandle } from '../providers/provider.js';
import { CliError } from './errors.js';
import { readLastBuild, saveLastBuild } from './local-state.js';
import { resolveProjectId } from './project-id.js';
import { resolveTarget } from './targets.js';
import { waitAndReport } from './job-report.js';
import { requireDeploymentProtocol } from './deployment-protocol.js';
import { withBuilderLease } from './builder-lease.js';
import { freezeSourceDir, type FrozenSource } from './source-freeze.js';

export function minutesArg(v: string | undefined, def: number): number {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n * 60_000 : def * 60_000;
}

export async function resolveGitSource(cwd: string, config: ShipConfig, log: Logger): Promise<BuildSource> {
  const repo = config.source?.repo ?? (await gitRemote(cwd));
  if (!repo) throw new CliError('no git origin remote and no config.source.repo — run inside the project repo or set source.repo');
  const ref = config.source?.ref ?? (await gitHeadSha(cwd)) ?? 'HEAD';
  log.info('build source', { repo: publicGitRepoUrl(repo), ref, auth: config.source?.token ? 'token' : 'none' });
  return { type: 'git', repo, ref, token: config.source?.token, ...(config.source?.username ? { username: config.source.username } : {}) };
}

/** upload the ONE frozen source artifact (S01/S03): the caller froze the tree
 *  (literal envFile exclusions applied by our code) BEFORE any machine was
 *  prepared — exactly that tarball, whose content the manifest digest covers */
export async function uploadFrozenSource(handle: BuilderHandle, frozen: FrozenSource, log: Logger): Promise<BuildSource> {
  const bytes = await readFile(frozen.tarball);
  if (bytes.length > 500 * 1024 * 1024) throw new CliError(`source tarball is ${Math.round(bytes.length / 1048576)}MB (limit 500MB)`);
  log.info('uploading frozen source tarball', { bytes: bytes.length, files: frozen.files, digest: frozen.contentDigest });
  const { id } = await apiUpload(handle.url, handle.token, bytes, 10 * 60_000, handle.caFile ? { caFile: handle.caFile } : {});
  return { type: 'tarball', id };
}

/** deployments bind to the pushed digest so mutable tags can never resolve to a stale image (F16) */
export function digestRef(imageRef: string, digest?: string): string {
  if (!digest) return imageRef;
  const at = imageRef.indexOf('@');
  if (at !== -1) {
    const existing = imageRef.slice(at + 1);
    if (existing !== digest) throw new CliError(`ref digest ${existing} disagrees with the reported digest ${digest}`);
    return imageRef;
  }
  const base = imageRef.replace(/:[^/:]+$/, '');
  return `${base}@${digest}`;
}

export interface BuildOutcome {
  project: string;
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
  /** runtime --env-file override must also be kept out of the build upload */
  envFile?: string;
  tag?: string;
  keepBuilder?: boolean;
  timeoutMs: number;
}): Promise<BuildOutcome> {
  const log = o.logger;
  const spec = loadSpecAt(o.cwd);
  const fromDir = o.fromDir ? path.resolve(o.cwd, o.fromDir) : undefined;
  const project = await resolveProjectId(o.cwd, o.config, fromDir);
  if (!o.config.registry) throw new CliError('config.registry (url + namespace) is required to push images');
  const registry = o.config.registry;
  // S03: freeze from-dir content BEFORE any machine exists; the frozen tarball
  // is the only thing uploaded, immune to concurrent workspace edits
  const envFiles = [spec.envFile, o.envFile].filter((f): f is string => Boolean(f));
  const frozen = fromDir ? await freezeSourceDir(fromDir, envFiles, o.cwd) : null;
  // the FULL task budget: build wait + push wait + upload/overhead (RA03)
  const taskBudgetMs = o.timeoutMs * 2 + 15 * 60_000;
  const runTask = async (handle: BuilderHandle): Promise<BuildOutcome> => {
    const source = frozen
      ? await uploadFrozenSource(handle, frozen, log)
      : await resolveGitSource(o.cwd, o.config, log);
    const httpOpts = handle.caFile ? { caFile: handle.caFile } : {};
    const started = await api<{ jobId: string }>(handle.url, handle.token, 'POST', '/api/build', { source, spec, tag: o.tag }, 20_000, httpOpts);
    const buildJob = await waitAndReport(handle, started.jobId, 'build', log, o.timeoutMs);
    const build = buildJob.result as BuildResult;

    const pushed = await api<{ jobId: string }>(handle.url, handle.token, 'POST', '/api/push', {
      name: spec.name,
      tag: build.tag,
      registry: registry.url,
      namespace: registry.namespace,
    }, 20_000, httpOpts);
    const pushJob = await waitAndReport(handle, pushed.jobId, 'push', log, o.timeoutMs);
    const push = pushJob.result as PushResult;

    const imageRef = digestRef(push.imageRef, push.digest);
    await saveLastBuild({ app: spec.name, project, imageRef, tag: build.tag, digest: push.digest, at: new Date().toISOString(), builderUrl: handle.url });
    return { project, spec, build, push, imageRef, builderUrl: handle.url };
  };
  // leased execution: another CLI cannot destroy this machine mid-task (RA04);
  // release happens on EVERY exit path unless a reuse window / flag kept it (F12/F20)
  try {
    const { value } = await withBuilderLease({ config: o.config, keepBuilder: o.keepBuilder, taskBudgetMs, log, run: runTask });
    return value;
  } finally {
    await frozen?.cleanup();
  }
}

export async function runDeployPipeline(o: {
  config: ShipConfig;
  cwd: string;
  logger: Logger;
  app?: string;
  imageRef?: string;
  /** Provenance supplied by an immediately preceding build, including local uploads. */
  project?: string;
  fromDir?: string;
  envFile?: string;
  keepEnv?: boolean;
  targetName?: string;
  timeoutMs: number;
}): Promise<DeployResult & { target: string }> {
  const log = o.logger;
  const spec = loadSpecAt(o.cwd);
  const app = o.app ?? spec.name;
  const project = o.project ?? await resolveProjectId(o.cwd, o.config, o.fromDir);
  const imageRef = o.imageRef ?? (await readLastBuild(app, project))?.imageRef;
  if (!imageRef) {
    throw new CliError(`no imageRef for app '${app}' — pass --ref or run \`ship build\` from this project first`);
  }

  const { name, target } = resolveTarget(o.config, o.targetName);
  const env = name; // the runtime target IS the environment identity

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
  const keepEnv = Boolean(o.keepEnv && envFileContent === undefined);
  const rt = await requireDeploymentProtocol(target, `runtime.targets.${name}`, keepEnv);
  const started = await api<{ jobId: string }>(rt.url, rt.token, 'POST', '/api/deploy', { app, project, env, imageRef, spec, envFileContent, keepEnv }, 20_000, rt.caFile ? { caFile: rt.caFile } : {});
  const job = await waitAndReport({ url: rt.url, token: rt.token, ...(rt.caFile ? { caFile: rt.caFile } : {}) }, started.jobId, 'deploy', log, o.timeoutMs);
  const result = job.result as DeployResult;
  return { ...result, target: name };
}
