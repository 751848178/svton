// v2 group recovery (R01–R03 + S02/S04): restore exactly the services this
// release actually changed.
// - The deployment identity is re-verified before EVERY recovery action — a
//   binding that changed/vanished/corrupted mid-recovery STOPS all further
//   actions (the machine is left as-is, and the report names what was already
//   cleaned vs what was abandoned).
// - First-deploy removal re-verifies compose ownership immediately before each
//   `down` so a foreign same-named project is never touched.
// - After restoring, each restored service with a declared probe is re-checked
//   and the summary keeps them SEPARATE: any failed probe fails the recovery;
//   a mix of probed and probe-less services reports verification as SKIPPED
//   (partial), never as fully "re-verified healthy".

import path from 'node:path';
import type { GroupServiceEntry } from './group-store-types.js';
import { assertProjectBinding, type BindingRequest } from './project-binding.js';
import { assertOwnedCompose } from './compose-ownership.js';
import { serviceDir, serviceProject } from './compose-service.js';
import { compose } from './docker.js';
import { switchService, verifyService } from './group-activation.js';

export interface RecoveryOutcome {
  succeeded: boolean;
  /** passed = every restored service probed healthy · failed = an action or probe failed · skipped = nothing probed or only part of the services had probes */
  verification: 'passed' | 'failed' | 'skipped';
  cleaned: string[];
  pending: string[];
  probed: number;
  probesSkipped: number;
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
  const groupDir = path.join(o.appsRoot, o.group);
  const cleaned: string[] = [];
  const pending: string[] = [];
  let hardFail = false;
  let abortedFor: string | null = null;

  // entry check: with an unverifiable identity there is nothing safe to do —
  // refuse BEFORE any action (per-action re-checks below cover the windows)
  try {
    await assertProjectBinding(groupDir, o.identity, false, false);
  } catch (e) {
    abortedFor = `binding re-check refused: ${(e as Error).message}`;
    for (const service of o.changedSoFar) {
      log(`recovery of ${service} REFUSED — deployment identity no longer verifiable: ${abortedFor}; the machine is left untouched, inspect it manually`);
      pending.push(service);
    }
    return { succeeded: false, verification: 'failed', cleaned, pending, probed: 0, probesSkipped: 0, detail: abortedFor };
  }

  for (const service of o.changedSoFar) {
    // S02: identity re-verified immediately before EVERY action — a change
    // stops the whole recovery instead of cleaning the next service anyway
    try {
      await assertProjectBinding(groupDir, o.identity, false, false);
    } catch (e) {
      abortedFor = `binding re-check before '${service}' refused: ${(e as Error).message}`;
      log(`recovery STOPPED before ${service} — ${abortedFor}; the machine is left as-is, inspect it manually`);
      pending.push(service);
      continue;
    }
    const prev = o.previousCombination?.[service];
    try {
      if (prev) {
        log(`recovering service ${service} to ${prev.imageRef}`);
        await switchService({ appsRoot: o.appsRoot, group: o.group, service, entry: prev, identity: o.identity, log, env: o.env });
        cleaned.push(service);
      } else {
        // first deploy: remove ONLY this service's project, ownership re-verified immediately before down (R01)
        const dir = serviceDir(o.appsRoot, o.group, service);
        const project = serviceProject(o.group, service);
        log(`no previous release for ${service} — removing what this deploy started (project ${project} only, ownership re-verified)`);
        await assertOwnedCompose({ dir, project, service });
        await compose({ appDir: dir, app: service, project, args: ['down'], log, env: o.env });
        cleaned.push(service);
      }
    } catch (e) {
      hardFail = true;
      log(`recovery of service ${service} FAILED: ${(e as Error).message} — inspect the machine; unselected services were not touched`);
    }
  }

  // per-service re-probe of RESTORED services only (R03/S04): skipped stays visible
  let probed = 0;
  let probesSkipped = 0;
  for (const service of cleaned) {
    const prev = o.previousCombination?.[service];
    if (!prev) continue; // removal path: nothing to probe
    let v: Awaited<ReturnType<typeof verifyService>>;
    try {
      v = await verifyService({ appsRoot: o.appsRoot, group: o.group, service, entry: prev, log });
    } catch (e) {
      // a HARD probe failure (docker exec error) must not lose the recovery
      // outcome — it counts as an unverified-failed probe, not a crash
      hardFail = true;
      log(`recovered service ${service} probe ERRORED: ${(e as Error).message} — treated as failed verification`);
      continue;
    }
    if (v.skipped) {
      probesSkipped++;
      continue;
    }
    probed++;
    if (!v.ok) {
      hardFail = true;
      log(`recovered service ${service} is still UNHEALTHY after restore — recovery cannot be reported as successful`);
    }
  }
  const failed = hardFail || Boolean(abortedFor);
  const verification = failed ? 'failed' : probesSkipped > 0 ? 'skipped' : probed > 0 ? 'passed' : 'skipped';
  const detail = [
    `cleaned=[${cleaned.join(',') || '-'}]`,
    `abandoned=[${pending.join(',') || '-'}]`,
    abortedFor ? `abort: ${abortedFor}` : null,
    `probes: ${probed} passed / ${probesSkipped} skipped(no probe declared)`,
  ].filter(Boolean).join('; ');
  return { succeeded: !failed, verification, cleaned, pending, probed, probesSkipped, detail };
}
