// v2 group deploy pipeline: deliver ONLY the changed services (digest-pinned,
// with their own provenance and runtime env) to the runtime agent; the agent
// merges them onto the latest committed combination inside its lock.

import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import type { Logger } from '../shared/log.js';
import { api } from '../shared/http.js';
import { createLogger } from '../shared/log.js';
import type { GroupDeployResult } from '../shared/group-protocol.js';
import type { GroupDeployRequest } from '../shared/group-protocol.js';
import type { ProjectSpec } from '../shared/spec-v2.js';
import type { ShipConfig } from '../shared/types.js';
import { CliError } from './errors.js';
import { resolveTarget } from './targets.js';
import { waitAndReport } from './job-report.js';
import { requireGroupProtocol } from './deployment-protocol.js';
import type { GroupBuildManifest } from './pipeline-multi.js';

export interface GroupDeployPipelineOptions {
  config: ShipConfig;
  cwd: string;
  logger: Logger;
  spec: ProjectSpec;
  project: string;
  manifest: GroupBuildManifest;
  /** per-service env file override (--env-file style is v1-only) */
  keepEnv?: boolean;
  /** private snapshot read before the build; never included in public output */
  envFiles?: Record<string, string>;
  targetName?: string;
  baseReleaseId?: string | null;
  timeoutMs: number;
}

/** read the declared env files of changed services (F32 env contract per service) */
export function readServiceEnvFiles(cwd: string, spec: ProjectSpec, selection: string[], keepEnv: boolean): Record<string, string> {
  const out: Record<string, string> = {};
  if (keepEnv) return out;
  for (const name of selection) {
    const declared = spec.services[name]?.envFile;
    if (!declared) continue;
    const abs = path.resolve(cwd, declared);
    if (!existsSync(abs)) {
      throw new CliError(`services.${name}.envFile '${declared}' not found — create it, or pass --keep-env to reuse the committed env`);
    }
    out[name] = readFileSync(abs, 'utf8');
  }
  return out;
}

export async function runGroupDeployPipeline(o: GroupDeployPipelineOptions): Promise<GroupDeployResult & { target: string }> {
  const log = o.logger;
  const { name, target } = resolveTarget(o.config, o.targetName);
  const env = name; // the runtime target IS the environment identity
  const rt = await requireGroupProtocol(target, `runtime.targets.${name}`);
  if (o.baseReleaseId !== undefined) await requireFeature(rt, 'group-baseline-v1');

  const changed: GroupDeployRequest['changed'] = {};
  for (const [svc, built] of Object.entries(o.manifest.services)) {
    changed[svc] = {
      imageRef: built.imageRef,
      tag: built.tag,
      digest: built.digest,
      source: {
        type: built.source.type,
        ...(built.source.type === 'git'
          ? { repo: (built.source as { repo?: string }).repo, ref: (built.source as { ref?: string }).ref }
          : {}),
        ...(built.sha ? { sha: built.sha } : {}),
        ...(built.source.type === 'tarball' && (built.source as { contentDigest?: string }).contentDigest
          ? { contentDigest: (built.source as { contentDigest?: string }).contentDigest }
          : {}),
      },
      ...(o.keepEnv ? { keepEnv: true } : {}),
    };
  }
  const envFiles = o.envFiles ?? readServiceEnvFiles(o.cwd, o.spec, Object.keys(o.manifest.services), Boolean(o.keepEnv));
  for (const [svc, content] of Object.entries(envFiles)) {
    if (changed[svc]) changed[svc].envFileContent = content;
  }
  if (Object.keys(envFiles).length > 0) log.info('attaching runtime env files', { services: Object.keys(envFiles), redacted: true });

  log.info('deploying group', { app: o.spec.name, services: Object.keys(changed), target: name });
  const handle = { url: rt.url, token: rt.token, ...(rt.caFile ? { caFile: rt.caFile } : {}) };
  const operationId = await log.operationId?.('deploy', undefined, handle);
  if (operationId) await requireFeature(rt, 'jobs-operation-v1');
  const started = await api<{ jobId: string }>(rt.url, rt.token, 'POST', '/api/deploy-group', {
    schemaVersion: 2,
    app: o.spec.name,
    project: o.project,
    env,
    spec: o.spec,
    changed,
    ...(o.baseReleaseId !== undefined ? { baseReleaseId: o.baseReleaseId } : {}),
    ...(operationId ? { operationId } : {}),
  } satisfies GroupDeployRequest, 20_000, rt.caFile ? { caFile: rt.caFile } : {});
  const job = await waitAndReport(handle, started.jobId, 'deploy', log, o.timeoutMs);
  const result = job.result as GroupDeployResult;
  return { ...result, target: name };
}

export async function runGroupRollbackCli(o: {
  config: ShipConfig;
  app: string;
  project: string;
  services?: string[];
  baseReleaseId?: string;
  targetReleaseId?: string;
  targetName?: string;
  logger?: Logger;
  timeoutMs?: number;
}): Promise<GroupDeployResult & { target: string }> {
  const { name, target } = resolveTarget(o.config, o.targetName);
  const rt = await requireGroupProtocol(target, `runtime.targets.${name}`);
  if (o.targetReleaseId) await requireFeature(rt, 'group-target-rollback-v1');
  const body: Record<string, unknown> = { app: o.app, project: o.project, env: name };
  if (o.services) body.services = o.services;
  if (o.baseReleaseId) body.baseReleaseId = o.baseReleaseId;
  if (o.targetReleaseId) body.targetReleaseId = o.targetReleaseId;
  const operationId = await o.logger?.operationId?.('deploy', undefined, rt);
  if (operationId) { await requireFeature(rt, 'jobs-operation-v1'); body.operationId = operationId; }
  const started = await api<{ jobId: string }>(rt.url, rt.token, 'POST', '/api/rollback-group', body, 20_000, rt.caFile ? { caFile: rt.caFile } : {});
  o.logger?.info('rollback started', { app: o.app, target: name, jobId: started.jobId });
  const job = await waitAndReport(rt, started.jobId, 'deploy', o.logger ?? createLogger(false), o.timeoutMs ?? 10 * 60_000);
  if (job.status === 'cancelled') throw new CliError('group rollback cancelled at a safe checkpoint', 130);
  if (job.status === 'failed') {
    const recovery = (job.result as { recovery?: { succeeded: boolean } } | undefined)?.recovery;
    throw new CliError(`group rollback failed: ${job.error}`, recovery && !recovery.succeeded ? 6 : 4);
  }
  const result = job.result as GroupDeployResult;
  return { ...result, target: name };
}

async function requireFeature(rt: { url: string; token: string; caFile?: string }, feature: string): Promise<void> {
  const status = await api<{ auth?: { capabilities?: string[] } }>(rt.url, rt.token, 'GET', '/api/status', undefined, 15_000, rt.caFile ? { caFile: rt.caFile } : {});
  if (!status.auth?.capabilities?.includes(feature)) throw new CliError(`runtime agent does not support ${feature}; upgrade it explicitly before using this operation`);
}
