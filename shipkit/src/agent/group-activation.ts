// v2 group activation (MS-04): verify external resource bindings, pre-pull
// every changed image, then switch/verify each changed service in its OWN
// compose project. Unselected services' projects are never written, so their
// containers are never restarted. Recovery restores ONLY the services this
// release actually changed (or removes them on a failed first deploy).

import { existsSync } from 'node:fs';
import { rm } from 'node:fs/promises';
import path from 'node:path';
import { exec } from '../shared/exec.js';
import type { ServiceSpec } from '../shared/spec-v2.js';
import { parseVolumeMount } from '../shared/spec-v2.js';
import type { GroupServiceEntry } from './group-store.js';
import { COMPOSE_ENV_FILE } from './compose.js';
import { writeFileAtomic } from './atomic.js';
import { compose, dockerPullImage, composePort } from './docker.js';
import { assertOwnedCompose } from './compose-ownership.js';
import { renderServiceCompose, serviceDir, serviceProject, writeServiceCompose, serviceExplicitHostPort, serviceFirstContainerPort } from './compose-service.js';
import { waitHealthy } from './healthcheck.js';

type Log = (line: string) => void;

export interface ServiceActivation {
  appsRoot: string;
  group: string;
  service: string;
  entry: GroupServiceEntry;
  log: Log;
  env?: Record<string, string>;
  /** invoked after ownership checks and file writes, immediately before
   *  `compose up` — the caller records the service as actually-switching so a
   *  failed up still gets recovered (a refused ownership check never reaches here) */
  onBeforeUp?: () => void;
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
  for (const n of networks) await inspectAllExist('network', n, ['network', 'inspect', n], log);
  for (const v of volumes) await inspectAllExist('volume', v, ['volume', 'inspect', v], log);
  for (const b of binds) {
    if (!existsSync(b)) {
      throw new Error(`bind mount host path '${b}' does not exist on the runtime — create it explicitly; refusing to auto-create host paths`);
    }
    log(`bind mount host path ok: ${b}`);
  }
}

async function inspectAllExist(kind: 'network' | 'volume', name: string, args: string[], log: Log): Promise<void> {
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

/** write this service's compose project files and recreate only its container */
export async function switchService(o: ServiceActivation): Promise<void> {
  const dir = serviceDir(o.appsRoot, o.group, o.service);
  const project = serviceProject(o.group, o.service);
  // ownership re-verified immediately before the only mutating step (pull window)
  await assertOwnedCompose({ dir, project, service: o.service });
  await writeServiceCompose(dir, renderServiceCompose(o.group, o.service, o.entry.imageRef, o.entry.spec, o.entry.env !== undefined));
  const envFile = path.join(dir, 'runtime.env');
  if (o.entry.env !== undefined) {
    await writeFileAtomic(envFile, o.entry.env.endsWith('\n') ? o.entry.env : `${o.entry.env}\n`, 0o600);
  } else {
    await rm(envFile, { force: true });
  }
  await writeFileAtomic(path.join(dir, COMPOSE_ENV_FILE), '');
  o.onBeforeUp?.();
  await compose({ appDir: dir, app: o.service, project, args: ['up', '-d'], log: o.log, env: o.env });
}

/** declared-health probe for one changed service */
export async function verifyService(o: { appsRoot: string; group: string; service: string; entry: GroupServiceEntry; log: Log }): Promise<{ ok: boolean; skipped?: string }> {
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
  const outcome = await waitHealthy({ url, timeoutMs: (spec.healthcheck.timeoutSeconds ?? 120) * 1000, log: o.log });
  return outcome.healthy ? { ok: true } : { ok: false };
}

/** restore the services this release actually changed: to their previous
 *  combination entry, or (first deploy) narrow removal of just their project */
export async function recoverServices(o: {
  appsRoot: string;
  group: string;
  previousCombination: Record<string, GroupServiceEntry> | null;
  changedSoFar: string[];
  log: Log;
  env?: Record<string, string>;
}): Promise<boolean> {
  let allOk = true;
  for (const service of o.changedSoFar) {
    const dir = serviceDir(o.appsRoot, o.group, service);
    const project = serviceProject(o.group, service);
    const prev = o.previousCombination?.[service];
    try {
      if (prev) {
        o.log(`recovering service ${service} to ${prev.imageRef}`);
        await switchService({ appsRoot: o.appsRoot, group: o.group, service, entry: prev, log: o.log, env: o.env });
      } else {
        o.log(`no previous release for ${service} — removing what this deploy started (project ${project} only)`);
        await compose({ appDir: dir, app: service, project, args: ['down'], log: o.log, env: o.env });
      }
    } catch (e) {
      allOk = false;
      o.log(`recovery of service ${service} FAILED: ${(e as Error).message} — inspect the machine; unselected services were not touched`);
    }
  }
  return allOk;
}
