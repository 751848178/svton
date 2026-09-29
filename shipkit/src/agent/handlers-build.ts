// Build job handler: source → docker build → local tag (F16 second-precision unique tags, F25 repo-root paths).

import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { validateSpec } from '../shared/spec-schema.js';
import type { BuildRequest, BuildResult } from '../shared/types.js';
import { dockerBuild } from './docker.js';
import type { JobContext } from './jobs.js';
import { ensureSource } from './source.js';

const pad2 = (n: number) => String(n).padStart(2, '0');

/** second precision + random suffix: concurrent/repeated builds can never collide on one tag (F16) */
export function defaultTag(sha?: string): string {
  const d = new Date();
  const ts = `${d.getFullYear()}${pad2(d.getMonth() + 1)}${pad2(d.getDate())}${pad2(d.getHours())}${pad2(d.getMinutes())}${pad2(d.getSeconds())}`;
  return [sha ? sha.slice(0, 7) : null, ts, randomUUID().slice(0, 4)].filter(Boolean).join('-');
}

export async function runBuild(workRoot: string, req: BuildRequest, log: JobContext['log']): Promise<BuildResult> {
  const spec = validateSpec(req.spec);
  const { dir, sha } = await ensureSource(workRoot, req.source, log);
  const tag = req.tag ?? defaultTag(sha);
  const localImage = `shipbuild/${spec.name}:${tag}`;
  const contextDir = path.join(dir, spec.context ?? '.');
  const dockerfileAbs = path.join(dir, spec.dockerfile ?? 'Dockerfile');
  log(`building ${localImage} (context ${spec.context ?? '.'}, dockerfile ${spec.dockerfile ?? 'Dockerfile'}, source ${dir})`);
  await dockerBuild({
    repoDir: dir,
    contextDir,
    dockerfileAbs,
    buildArgs: spec.buildArgs ?? {},
    tag: localImage,
    log,
  });
  log(`built ${localImage}`);
  return { name: spec.name, tag, localImage, sha };
}
