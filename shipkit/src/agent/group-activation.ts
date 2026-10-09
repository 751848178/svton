// v2 group activation (MS-04 + R02): verify external resource bindings, pull
// each changed image, then switch/verify each changed service in its OWN
// compose project. The deployment identity (project/env) is re-verified
// together with compose ownership immediately before EVERY mutating step — a
// binding that changed, vanished or corrupted during the pull window refuses
// the switch instead of writing into someone else's deployment.

import { existsSync } from 'node:fs';
import { rm } from 'node:fs/promises';
import path from 'node:path';
import { exec } from '../shared/exec.js';
import type { ServiceSpec } from '../shared/spec-v2.js';
import { parseVolumeMount } from '../shared/spec-v2.js';
import type { GroupServiceEntry } from './group-store-types.js';
import { COMPOSE_ENV_FILE } from './compose.js';
import { writeFileAtomic } from './atomic.js';
import { compose, dockerPullImage, composePort } from './docker.js';
import { assertOwnedCompose } from './compose-ownership.js';
import { assertProjectBinding, ProjectBindingRefusal, type BindingRequest } from './project-binding.js';
import { renderServiceCompose, serviceDir, serviceProject, writeServiceCompose, serviceExplicitHostPort, serviceFirstContainerPort } from './compose-service.js';
import { waitHealthy } from './healthcheck.js';

type Log = (line: string) => void;

export interface ServiceActivation {
  appsRoot: string;
  group: string;
  service: string;
  entry: GroupServiceEntry;
  /** deployment identity re-verified (with ownership) before the mutating step */
  identity: BindingRequest;
  log: Log;
  env?: Record<string, string>;
  /** invoked after ownership+binding checks and file writes, immediately before
   *  `compose up` — the caller records the service as actually-switching so a
   *  failed up still gets recovered (a refused check never reaches here) */
  onBeforeUp?: () => void;
}

/** A binding refusal remains a safety stop even if an operator repairs the
 *  file before recovery catches it. Do not infer identity failures from text. */
export class ActivationBindingRefusal extends ProjectBindingRefusal {
  constructor(cause: unknown) {
    super(cause instanceof Error ? cause.message : String(cause), { cause });
    this.name = 'ActivationBindingRefusal';
  }
}

async function assertActivationOwner(o: ServiceActivation, dir: string, project: string): Promise<void> {
  await assertOwnedCompose({ dir, project, service: o.service });
  try {
    await assertProjectBinding(path.join(o.appsRoot, o.group), o.identity, false, false);
  } catch (e) {
    throw new ActivationBindingRefusal(e);
  }
}

/** declared external networks / volumes / bind paths of the changed services
 *  must ALL exist before anything is pulled or switched — a missing external
 *  resource preserves the current state instead of failing mid-switch */
export async function verifyExternalBindings(specs: Record<string, ServiceSpec>, changed: string[], log: Log): Promise<void> {
  const networks = new Set<string>();
  const volumes = new Set<string>();
  const binds = new Set<string>();
  for (const name of changed) {
    const svc = specs[name];
    if (!svc) throw new Error(`no spec for changed service '${name}'`);
    for (const n of svc.networks ?? []) networks.add(n);
    for (const v of svc.volumes ?? []) {
      const m = parseVolumeMount(v, `services.${name}.volumes`);
      (m.kind === 'volume' ? volumes : binds).add(m.source);
    }
  }
  for (const n of networks) await assertExternalExists('network', n, ['network', 'inspect', n], log);
  for (const v of volumes) await assertExternalExists('volume', v, ['volume', 'inspect', v], log);
  for (const b of binds) {
    if (!existsSync(b)) {
      throw new Error(`bind mount host path '${b}' does not exist on the runtime — create it explicitly; refusing to auto-create host paths`);
    }
    log(`bind mount host path ok: ${b}`);
  }
}

async function assertExternalExists(kind: 'network' | 'volume', name: string, args: string[], log: Log): Promise<void> {
  const r = await exec('docker', args, { timeoutMs: 20_000 });
  if (r.code === 0) {
    log(`external ${kind} '${name}' exists`);
    return;
  }
  throw new Error(
    `declared external ${kind} '${name}' does not exist on this runtime (docker ${kind} inspect failed) — ` +
    `create it first or fix ship.yaml; current services are untouched`,
  );
}

/** pre-pull one changed image; ALL changed images must land before the first switch */
export function pullServiceImage(imageRef: string, log: Log, env?: Record<string, string>): Promise<void> {
  return dockerPullImage({ imageRef, log, env });
}

/** ownership + deployment identity re-verified, then write this service's
 *  compose project files and recreate only its container */
export async function switchService(o: ServiceActivation): Promise<void> {
  const dir = serviceDir(o.appsRoot, o.group, o.service);
  const project = serviceProject(o.group, o.service);
  // RE-VERIFY ownership AND the (project, env) binding immediately before the
  // mutating step: the pre-flight gate ran before any state was written, but
  // the pull window allows a foreign actor — or a binding edit — to land here
  await assertActivationOwner(o, dir, project);
  await writeServiceCompose(dir, renderServiceCompose(o.group, o.service, o.entry.imageRef, o.entry.spec, o.entry.env !== undefined, o.entry.env));
  const envFile = path.join(dir, 'runtime.env');
  if (o.entry.env !== undefined) {
    await writeFileAtomic(envFile, o.entry.env.endsWith('\n') ? o.entry.env : `${o.entry.env}\n`, 0o600);
  } else {
    await rm(envFile, { force: true });
  }
  await writeFileAtomic(path.join(dir, COMPOSE_ENV_FILE), '');
  // File writes yield to other actors. Re-check before the actual container
  // mutation, and record a switched service only after this final gate passes.
  await assertActivationOwner(o, dir, project);
  o.onBeforeUp?.();
  await compose({ appDir: dir, app: o.service, project, args: ['up', '-d'], log: o.log, env: o.env });
}

/** declared-health probe for one changed service */
export async function verifyService(o: { appsRoot: string; group: string; service: string; entry: GroupServiceEntry; log: Log; checkpoint?: () => void }): Promise<{ ok: boolean; skipped?: string }> {
  o.checkpoint?.();
  const spec = o.entry.spec;
  let hostPort = serviceExplicitHostPort(spec);
  if (!hostPort && spec.healthcheck?.path) {
    const cp = serviceFirstContainerPort(spec);
    if (cp) {
      hostPort = await composePort({
        appDir: serviceDir(o.appsRoot, o.group, o.service),
        app: o.service, project: serviceProject(o.group, o.service), service: o.service, containerPort: cp,
      }) ?? undefined;
    }
  }
  if (!hostPort || !spec.healthcheck?.path) {
    o.log(`service ${o.service}: no healthcheck resolvable — verification SKIPPED`);
    return { ok: true, skipped: `service ${o.service}: no healthcheck/port resolvable` };
  }
  const url = `http://127.0.0.1:${hostPort}${spec.healthcheck.path}`;
  const outcome = await waitHealthy({ url, timeoutMs: (spec.healthcheck.timeoutSeconds ?? 120) * 1000, log: o.log, checkpoint: o.checkpoint });
  return outcome.healthy ? { ok: true } : { ok: false };
}
