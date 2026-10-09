// Build job handler: source → docker build → local tag (F16 second-precision unique tags, F25 repo-root paths).

import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { validateSpec } from '../shared/spec-schema.js';
import type { BuildRequest, BuildResult } from '../shared/types.js';
import { dockerBuild } from './docker.js';
import type { JobContext } from './jobs.js';
import { ensureSource } from './source.js';
import type { JobControl } from './job-control.js';

const pad2 = (n: number) => String(n).padStart(2, '0');

/** second precision + random suffix: concurrent/repeated builds can never collide on one tag (F16) */
export function defaultTag(sha?: string): string {
  const d = new Date();
  const ts = `${d.getFullYear()}${pad2(d.getMonth() + 1)}${pad2(d.getDate())}${pad2(d.getHours())}${pad2(d.getMinutes())}${pad2(d.getSeconds())}`;
  return [sha ? sha.slice(0, 7) : null, ts, randomUUID().slice(0, 4)].filter(Boolean).join('-');
}

export async function runBuild(workRoot: string, req: BuildRequest, log: JobContext['log'], control?: JobControl): Promise<BuildResult> {
  control?.checkpoint();
  control?.phase('source', req.spec.name);
  const spec = validateSpec(req.spec);
  const { dir, sha } = await ensureSource(workRoot, req.source, log);
  control?.checkpoint();
  control?.phase('build', spec.name);
  const tag = req.tag ?? defaultTag(sha);
  const localImage = `shipbuild/${spec.name}:${tag}`;
  const contextDir = path.join(dir, spec.context ?? '.');
  const dockerfileAbs = path.join(dir, spec.dockerfile ?? 'Dockerfile');
  log(`building ${localImage} (context ${spec.context ?? '.'}, dockerfile ${spec.dockerfile ?? 'Dockerfile'}${spec.target ? `, target ${spec.target}` : ''}${spec.platform ? `, platform ${spec.platform}` : ''}, source ${dir})`);
  const built = await dockerBuild({
    repoDir: dir,
    contextDir,
    dockerfileAbs,
    buildArgs: spec.buildArgs ?? {},
    tag: localImage,
    target: spec.target,
    platform: spec.platform,
    log,
  });
  // The current Docker command has completed; cancellation never kills shared daemon work.
  control?.checkpoint();
  // platform gate: the produced image must really be what the request declared
  if (spec.platform && built.arch && built.arch !== spec.platform) {
    throw new Error(`built image is ${built.arch} but the request pinned ${spec.platform} — refusing to continue with a mismatched architecture`);
  }
  log(`built ${localImage} (${built.arch ?? 'unknown arch'})`);
  return { name: spec.name, tag, localImage, sha, arch: built.arch };
}
