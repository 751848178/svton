// Multi-service build pipeline (MS-02): ONE leased builder builds every
// SELECTED service serially (same source), then pushes all of them; a
// deployable manifest exists ONLY after every build AND push/digest check
// succeeded. Mid-failures may leave pushed images behind but never report a
// complete build.

import path from 'node:path';
import type { Logger } from '../shared/log.js';
import { api } from '../shared/http.js';
import { JOB_OPERATION_CAPABILITY, JOB_EVENTS_CAPABILITY, JOB_LOG_CURSOR_CAPABILITY, JOB_CANCELLATION_CAPABILITY } from '../shared/job-protocol.js';
import { publicGitRepoUrl } from '../shared/git-url.js';
import type { BuildResult, PushResult, ShipConfig, BuildSource } from '../shared/types.js';
import type { ProjectSpec } from '../shared/spec-v2.js';
import { buildSliceFor } from '../shared/spec-v2.js';
import type { BuilderHandle } from '../providers/provider.js';
import { CliError } from './errors.js';
import { digestRef, resolveGitSource, uploadFrozenSource } from './pipeline.js';
import { freezeSourceDir, type FrozenSource } from './source-freeze.js';
import { saveLastBuild } from './local-state.js';
import { resolveProjectId } from './project-id.js';
import { waitAndReport } from './job-report.js';
import { assertBuilderGroupCapability } from './deployment-protocol.js';
import { withBuilderLease, type BuilderReleaseOutcome } from './builder-lease.js';
import { resolveSelection } from './service-selection.js';
import { assertUniqueImageRepositories, serviceImageRepository } from '../shared/service-image-repository.js';

async function requireManagedBuilder(handle: BuilderHandle): Promise<void> {
  const status = await api<{ auth?: { capabilities?: string[] } }>(handle.url, handle.token, 'GET', '/api/status', undefined, 15_000, handle);
  const capabilities = status?.auth?.capabilities;
  const required = ['build', 'push', JOB_OPERATION_CAPABILITY, JOB_EVENTS_CAPABILITY, JOB_LOG_CURSOR_CAPABILITY, JOB_CANCELLATION_CAPABILITY];
  const missing = required.filter((capability) => !Array.isArray(capabilities) || !capabilities.includes(capability));
  if (missing.length) throw new CliError(`构建机缺少平台安全协议 ${missing.join(', ')} — 请升级构建机镜像/安装包并使用 builder 凭据；本次未上传源码、未构建、未推送`);
}

/** per-service provenance: git keeps repo/ref/sha; from-dir keeps a content
 *  digest of the exact uploaded tree — no fabricated git identity (R10) */
export interface GroupBuildProvenance {
  type: 'git' | 'tarball';
  id?: string;
  repo?: string;
  ref?: string;
  sha?: string;
  contentDigest?: string;
}

export interface GroupBuildService {
  imageRef: string;
  tag: string;
  digest?: string;
  sha?: string;
  /** the EFFECTIVE platform this slice built for (service override wins) */
  platform: string;
  /** the arch the builder actually reported, when known */
  arch?: string;
  /** true only when arch was confirmed === platform (never asserted blindly) */
  archVerified: boolean;
  source: GroupBuildProvenance;
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
  /** explicit tag applies to each selected image; repositories stay distinct */
  tag?: string;
  keepBuilder?: boolean;
  spec: ProjectSpec;
  selection: string[];
  /** phase 1: every group service builds for linux/amd64 */
  platform?: string;
  timeoutMs: number;
  expectedSourceDigest?: string;
  expectedGitSha?: string;
  managedCancellation?: boolean;
}): Promise<GroupBuildManifest> {
  const log = o.logger;
  const platform = o.platform ?? 'linux/amd64';
  if (o.selection.length === 0) throw new CliError('selection is empty — nothing to build');
  assertUniqueImageRepositories(o.spec.services);
  resolveSelection(o.spec, o.selection);
  if (!o.config.registry) throw new CliError('config.registry (url + namespace) is required to push images');
  const registry = o.config.registry;
  const fromDir = o.fromDir ? path.resolve(o.cwd, o.fromDir) : undefined;
  const project = await resolveProjectId(o.cwd, o.config, fromDir);
  const envFiles = [...new Set(Object.values(o.spec.services).map((s) => s.envFile).filter((f): f is string => Boolean(f)))];
  // S01/S03 + R10: freeze ONCE before any machine/capability work — the frozen
  // tarball (literal envFile exclusions, applied by our code) is the ONLY thing
  // uploaded, and its contentDigest covers exactly those bytes; later workspace
  // edits can no longer desync the manifest from the upload
  const frozen: FrozenSource | null = fromDir ? await freezeSourceDir(fromDir, envFiles, o.cwd) : null;
  if (o.expectedSourceDigest && frozen?.contentDigest !== o.expectedSourceDigest) {
    await frozen?.cleanup();
    throw new CliError('Source changed after planning — generate a fresh plan before building');
  }
  if (frozen) log.info('source frozen', { digest: frozen.contentDigest, files: frozen.files, bytes: frozen.bytes });
  const taskBudgetMs = o.timeoutMs * o.selection.length * 2 + 15 * 60_000;

  const run = async (handle: BuilderHandle): Promise<GroupBuildManifest> => {
    // an old builder cannot parse target/platform — refuse before ANY build (and before pushing anything)
    await assertBuilderGroupCapability(handle);
    if (o.managedCancellation) await requireManagedBuilder(handle);
    const httpOpts = handle.caFile ? { caFile: handle.caFile } : {};
    const source = frozen
      ? await uploadFrozenSource(handle, frozen, log)
      : await resolveGitSource(o.cwd, o.config, log);
    if (o.managedCancellation && source.type === 'git' && source.token && !/^https:\/\//.test(handle.url)
      && !/^http:\/\/(localhost|127\.0\.0\.1|\[::1\])(?::|\/|$)/.test(handle.url)) throw new CliError('Private Git credentials require HTTPS or a controlled loopback Agent tunnel');

    // serial builds on the SAME machine, each with its own Dockerfile slice
    const builds: Record<string, BuildResult> = {};
    for (const name of o.selection) {
      await log.checkpoint?.();
      const svcSpec = o.spec.services[name];
      if (!svcSpec) throw new CliError(`selection contains '${name}' which is not declared in the group spec`);
      const slice = buildSliceFor(name, svcSpec, platform);
      log.info(`building service ${name}`, { imageRepository: slice.name, target: slice.target, platform: slice.platform });
      const operationId = await log.operationId?.('build', name, handle);
      const started = await api<{ jobId: string }>(handle.url, handle.token, 'POST', '/api/build', { source, spec: slice, tag: o.tag, ...(operationId ? { operationId } : {}) }, 20_000, httpOpts);
      builds[name] = (await waitAndReport(handle, started.jobId, `build:${name}`, log, o.timeoutMs)).result as BuildResult;
      if (o.expectedGitSha && builds[name]?.sha?.toLowerCase() !== o.expectedGitSha.toLowerCase()) {
        throw new CliError(`build:${name} did not return the planned Git SHA; refusing every push and deploy`);
      }
    }

    // every build succeeded → push all; every digest verified → manifest
    const services: Record<string, GroupBuildService> = {};
    for (const name of o.selection) {
      await log.checkpoint?.();
      const build = builds[name];
      if (!build) throw new CliError(`internal: build result for '${name}' missing after successful build phase`);
      const svcSpec = o.spec.services[name]!;
      const effectivePlatform = svcSpec.platform ?? platform;
      // R11: a KNOWN arch that contradicts the declared platform refuses; an
      // unknown arch is recorded as unverified, never claimed as checked
      if (build.arch && build.arch !== effectivePlatform) {
        throw new CliError(`build:${name} produced ${build.arch} but the effective platform is ${effectivePlatform} — refusing to continue`);
      }
      const operationId = await log.operationId?.('push', name, handle);
      const pushed = await api<{ jobId: string }>(handle.url, handle.token, 'POST', '/api/push', {
        name: serviceImageRepository(name, svcSpec), tag: build.tag, registry: registry.url, namespace: registry.namespace,
        ...(operationId ? { operationId } : {}),
      }, 20_000, httpOpts);
      const pushJob = await waitAndReport(handle, pushed.jobId, `push:${name}`, log, o.timeoutMs);
      const push = pushJob.result as PushResult;
      // R07: a deployable manifest requires a verified digest-pinned ref — a
      // push without a valid digest stays a mutable tag and is refused here
      const digestOk = /^sha256:[0-9a-f]{64}$/.test(push.digest ?? '');
      if (!digestOk) {
        throw new CliError(`push:${name} returned no valid digest (${JSON.stringify(push.digest)}) — refusing a deployable manifest on a mutable tag`);
      }
      const pinned = digestRef(push.imageRef, push.digest);
      services[name] = {
        imageRef: pinned, tag: build.tag, digest: push.digest,
        ...(build.sha ? { sha: build.sha } : {}),
        platform: effectivePlatform,
        ...(build.arch ? { arch: build.arch } : {}),
        archVerified: build.arch === effectivePlatform,
        source: frozen
          ? { type: 'tarball', contentDigest: frozen.contentDigest }
          : { type: 'git', ...(source.type === 'git' ? { repo: publicGitRepoUrl(source.repo), ref: source.ref } : {}) },
      };
      await saveLastBuild({ app: o.spec.name, project, service: name, imageRef: pinned, tag: build.tag, digest: push.digest, at: new Date().toISOString(), builderUrl: handle.url });
    }
    return { project, spec: o.spec, services, builderUrl: handle.url, builderRelease: { builderRelease: 'static' } };
  };

  try {
    const { value, release } = await withBuilderLease({ config: o.config, keepBuilder: o.keepBuilder, taskBudgetMs, log, run, managedCancellation: o.managedCancellation });
    return { ...value, builderRelease: release };
  } finally {
    await frozen?.cleanup();
  }
}
