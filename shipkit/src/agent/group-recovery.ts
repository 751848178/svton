// v2 group recovery (R01/R02/R03): restore exactly the services this release
// actually changed. Before ANY recovery action the deployment identity is
// re-verified — a binding that changed/vanished/corrupted during the deploy
// window refuses recovery (the machine is left as-is and reported honestly).
// First-deploy removal re-verifies compose ownership immediately before each
// `down` so a foreign same-named project is never touched. After restoring,
// every RESTORED service with a declared probe is re-checked: a still-unhealthy
// restore reports succeeded=false; services without probes report the recovery
// as verification-skipped, never as verified.

import path from 'node:path';
import type { GroupServiceEntry } from './group-store-types.js';
import { assertProjectBinding, type BindingRequest } from './project-binding.js';
import { assertOwnedCompose } from './compose-ownership.js';
import { serviceDir, serviceProject } from './compose-service.js';
import { compose } from './docker.js';
import { switchService, verifyService } from './group-activation.js';

export interface RecoveryOutcome {
  succeeded: boolean;
  /** passed = restored services re-probed healthy · failed = a restore or probe failed · skipped = no probes declared */
  verification: 'passed' | 'failed' | 'skipped';
  detail: string;
}

export async function recoverServices(o: {
  appsRoot: string;
  group: string;
  identity: BindingRequest;
  previousCombination: Record<string, GroupServiceEntry> | null;
  changedSoFar: string[];
  log: (line: string) => void;
  env?: Record<string, string>;
}): Promise<RecoveryOutcome> {
  const log = o.log;
  // R02: binding re-verified once before touching anything — lost/corrupt/changed refuses ALL recovery
  try {
    await assertProjectBinding(path.join(o.appsRoot, o.group), o.identity, false, false);
  } catch (e) {
    const reason = (e as Error).message;
    for (const service of o.changedSoFar) {
      log(`recovery of ${service} REFUSED — deployment identity no longer verifiable: ${reason}; the machine is left untouched, inspect it manually`);
    }
    return { succeeded: false, verification: 'failed', detail: `binding re-check refused: ${reason}` };
  }

  const restored: string[] = [];
  let hardFail = false;
  for (const service of o.changedSoFar) {
    const prev = o.previousCombination?.[service];
    try {
      if (prev) {
        log(`recovering service ${service} to ${prev.imageRef}`);
        await switchService({ appsRoot: o.appsRoot, group: o.group, service, entry: prev, identity: o.identity, log, env: o.env });
        restored.push(service);
      } else {
        // first deploy: remove ONLY this service's project, ownership re-verified immediately before down (R01)
        const dir = serviceDir(o.appsRoot, o.group, service);
        const project = serviceProject(o.group, service);
        log(`no previous release for ${service} — removing what this deploy started (project ${project} only, ownership re-verified)`);
        await assertOwnedCompose({ dir, project, service });
        await compose({ appDir: dir, app: service, project, args: ['down'], log, env: o.env });
      }
    } catch (e) {
      hardFail = true;
      log(`recovery of service ${service} FAILED: ${(e as Error).message} — inspect the machine; unselected services were not touched`);
    }
  }

  // R03: re-check health of every RESTORED service with a declared probe
  let probed = false;
  let probeFail = false;
  for (const service of restored) {
    const prev = o.previousCombination?.[service];
    if (!prev) continue;
    const v = await verifyService({ appsRoot: o.appsRoot, group: o.group, service, entry: prev, log });
    if (v.skipped) continue; // no probe declared — reported as skipped, not verified
    probed = true;
    if (!v.ok) {
      probeFail = true;
      log(`recovered service ${service} is still UNHEALTHY after restore — recovery cannot be reported as successful`);
    }
  }
  const verification = hardFail || probeFail ? 'failed' : probed ? 'passed' : 'skipped';
  return { succeeded: !hardFail && !probeFail, verification, detail: `${restored.length} restored, verification ${verification}` };
}
