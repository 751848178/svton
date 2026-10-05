// Multi-service build pipeline (MS-02): ONE leased builder builds every
// SELECTED service serially (same source), then pushes all of them; a
// deployable manifest exists ONLY after every build AND push/digest check
// succeeded. Mid-failures may leave pushed images behind but never report a
// complete build.

import path from 'node:path';
import type { Logger } from '../shared/log.js';
import { api } from '../shared/http.js';
import type { BuildResult, PushResult, ShipConfig, BuildSource } from '../shared/types.js';
import type { ProjectSpec } from '../shared/spec-v2.js';
import { buildSliceFor } from '../shared/spec-v2.js';
import type { BuilderHandle } from '../providers/provider.js';
import { CliError } from './errors.js';
import { digestRef, resolveGitSource, uploadTarballSource } from './pipeline.js';
import { saveLastBuild } from './local-state.js';
import { resolveProjectId } from './project-id.js';
import { waitAndReport } from './job-report.js';
import { assertBuilderGroupCapability } from './deployment-protocol.js';
import { withBuilderLease, type BuilderReleaseOutcome } from './builder-lease.js';

export interface GroupBuildService {
  imageRef: string;
  tag: string;
  digest?: string;
  sha?: string;
  platform: string;
  source: BuildSource;
}

/** the deployable build manifest: per-service digest-pinned refs and their OWN
 *  provenance (source type/sha) — inherited services are added by the runtime */
export interface GroupBuildManifest {
  project: string;
  spec: ProjectSpec;
  services: Record<string, GroupBuildService>;
  builderUrl: string;
  builderRelease: BuilderReleaseOutcome;
}

export async function runMultiBuildPipeline(o: {
  config: ShipConfig;
  cwd: string;
  logger: Logger;
  fromDir?: string;
  keepBuilder?: boolean;
  spec: ProjectSpec;
  selection: string[];
  /** phase 1: every group service builds for linux/amd64 */
  platform?: string;
  timeoutMs: number;
}): Promise<GroupBuildManifest> {
  const log = o.logger;
  const platform = o.platform ?? 'linux/amd64';
  if (o.selection.length === 0) throw new CliError('selection is empty — nothing to build');
  if (!o.config.registry) throw new CliError('config.registry (url + namespace) is required to push images');
  const registry = o.config.registry;
  const fromDir = o.fromDir ? path.resolve(o.cwd, o.fromDir) : undefined;
  const project = await resolveProjectId(o.cwd, o.config, fromDir);
  const envFiles = [...new Set(Object.values(o.spec.services).map((s) => s.envFile).filter((f): f is string => Boolean(f)))];
  const taskBudgetMs = o.timeoutMs * o.selection.length * 2 + 15 * 60_000;

  const run = async (handle: BuilderHandle): Promise<GroupBuildManifest> => {
    // an old builder cannot parse target/platform — refuse before ANY build (and before pushing anything)
    await assertBuilderGroupCapability(handle);
    const httpOpts = handle.caFile ? { caFile: handle.caFile } : {};
    const source = fromDir
      ? await uploadTarballSource(handle, fromDir, envFiles, log)
      : await resolveGitSource(o.cwd, o.config, log);

    // serial builds on the SAME machine, each with its own Dockerfile slice
    const builds: Record<string, BuildResult> = {};
    for (const name of o.selection) {
      const svcSpec = o.spec.services[name];
      if (!svcSpec) throw new CliError(`selection contains '${name}' which is not declared in the group spec`);
      const slice = buildSliceFor(name, svcSpec, platform);
      log.info(`building service ${name}`, { target: slice.target, platform: slice.platform });
      const started = await api<{ jobId: string }>(handle.url, handle.token, 'POST', '/api/build', { source, spec: slice }, 20_000, httpOpts);
      builds[name] = (await waitAndReport(handle, started.jobId, `build:${name}`, log, o.timeoutMs)).result as BuildResult;
    }

    // every build succeeded → push all; every digest verified → manifest
    const services: Record<string, GroupBuildService> = {};
    for (const name of o.selection) {
      const build = builds[name];
      if (!build) throw new CliError(`internal: build result for '${name}' missing after successful build phase`);
      const pushed = await api<{ jobId: string }>(handle.url, handle.token, 'POST', '/api/push', {
        name, tag: build.tag, registry: registry.url, namespace: registry.namespace,
      }, 20_000, httpOpts);
      const pushJob = await waitAndReport(handle, pushed.jobId, `push:${name}`, log, o.timeoutMs);
      const push = pushJob.result as PushResult;
      const imageRef = digestRef(push.imageRef, push.digest);
      services[name] = { imageRef, tag: build.tag, digest: push.digest, sha: build.sha, platform, source };
      await saveLastBuild({ app: o.spec.name, project, service: name, imageRef, tag: build.tag, digest: push.digest, at: new Date().toISOString(), builderUrl: handle.url });
    }
    return { project, spec: o.spec, services, builderUrl: handle.url, builderRelease: { builderRelease: 'static' } };
  };

  const { value, release } = await withBuilderLease({ config: o.config, keepBuilder: o.keepBuilder, taskBudgetMs, log, run });
  return { ...value, builderRelease: release };
}
