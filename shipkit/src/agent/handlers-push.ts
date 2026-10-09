// Push job handler: docker login (env creds) → retag to registry ref → push → logout.

import type { PushRequest, PushResult } from '../shared/types.js';
import { dockerPushAsImageRef, requireEnv } from './docker.js';
import { resolvePushCreds } from './registry-creds.js';
import type { JobContext } from './jobs.js';
import type { JobControl } from './job-control.js';

export function resolveImageRef(req: PushRequest): { imageRef: string; registry: string } {
  const registry = req.registry ?? requireEnv('SHIP_REGISTRY');
  const namespace = req.namespace ?? process.env.SHIP_NAMESPACE ?? '';
  const imageRef = [registry, namespace, `${req.name}:${req.tag}`].filter(Boolean).join('/');
  return { imageRef, registry };
}

export async function runPush(req: PushRequest, log: JobContext['log'], workRoot?: string, control?: JobControl): Promise<PushResult> {
  control?.checkpoint();
  control?.phase('push', req.name);
  if (!/^[a-z0-9._/-]+$/.test(req.name) || !/^[\w.-]+$/.test(req.tag)) {
    throw new Error(`invalid image name/tag: ${req.name}:${req.tag}`);
  }
  const { imageRef, registry } = resolveImageRef(req);
  const localImage = `shipbuild/${req.name}:${req.tag}`;
  log(`pushing ${localImage} -> ${imageRef}`);
  const creds = await resolvePushCreds(workRoot ?? process.env.SHIP_WORK_ROOT ?? '/opt/shipkit-data');
  const { digest } = await dockerPushAsImageRef({ localImage, imageRef, registry, creds, log });
  // Pushed images may remain; no runtime service was activated by this job.
  control?.checkpoint();
  log(`pushed ${imageRef} (${digest ?? 'digest unknown'})`);
  return { imageRef, digest };
}
