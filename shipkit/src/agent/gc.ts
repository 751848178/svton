// Ledger-aware image GC (F34 + RA01/RA02/RA08/RA09):
// - protection loading is STRICT: any unreadable/corrupt state or retained snapshot aborts the whole GC
// - execution holds the machine writer slot, so no deploy can add references mid-run (and vice versa)
// - candidates come from the persistent image ledger, not the 20-entry history cap
// - docker errors are classified: only a definite image-not-found is "missing"; everything else fails

import { readdir } from 'node:fs/promises';
import path from 'node:path';
import type { ExecResult } from '../shared/exec.js';
import { gcDockerRun } from './gc-docker.js';
import { withDeploySlot, withGcSlot } from './app-lock.js';
import { ImageLedger } from './image-ledger.js';
import { ReleaseStore } from './release.js';

export interface GcCandidate {
  imageRef: string;
  app: string;
  addedAt?: string;
}

export interface GcPlan {
  protectedRefs: string[];
  candidates: GcCandidate[];
}

export type DockerRun = (args: string[]) => Promise<ExecResult>;

const defaultDockerRun: DockerRun = (args) => gcDockerRun(args);

const NOT_FOUND_RE = /no such image|manifest unknown|no such reference|image not found|not found/i;

/** strict: throws on any unreadable/corrupt state or retained snapshot (RA01) */
async function protectedRefs(appsRoot: string, store: ReleaseStore): Promise<Set<string>> {
  const protectedSet = new Set<string>();
  let appDirs: string[];
  try {
    appDirs = (await readdir(appsRoot, { withFileTypes: true })).filter((e) => e.isDirectory()).map((e) => e.name);
  } catch (e) {
    // a machine that never deployed anything has no apps root — that is empty, not corruption
    if ((e as NodeJS.ErrnoException).code === 'ENOENT') return protectedSet;
    throw new Error(`GC aborted: cannot read apps root ${appsRoot}: ${(e as Error).message}`);
  }
  for (const app of appDirs) {
    const state = await store.loadState(app); // corrupt → throws (loadState is strict except ENOENT)
    // current/previous MUST resolve to complete snapshots — "unknown reference" is never "no reference"
    for (const id of [state.current, state.previous]) {
      if (!id) continue;
      const rel = await store.loadRelease(app, id);
      protectedSet.add(rel.imageRef);
    }
    let releaseIds: string[];
    try {
      releaseIds = await readdir(path.join(appsRoot, app, 'releases'));
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code !== 'ENOENT') throw new Error(`GC aborted: cannot read releases of '${app}': ${(e as Error).message}`);
      releaseIds = [];
    }
    for (const id of releaseIds) {
      const rel = await store.loadRelease(app, id);
      protectedSet.add(rel.imageRef);
    }
  }
  return protectedSet;
}

export function ledgerFileFor(appsRoot: string): string {
  return path.join(path.dirname(appsRoot), 'image-ledger.json');
}

export async function planImageGc(appsRoot: string): Promise<GcPlan> {
  const store = new ReleaseStore(appsRoot);
  const protectedSet = await protectedRefs(appsRoot, store);
  const ledger = new ImageLedger(ledgerFileFor(appsRoot));
  const candidates: GcCandidate[] = [];
  // primary source: persistent ledger (RA08) — survives >20 deploys
  for (const e of await ledger.entries()) {
    if (!protectedSet.has(e.imageRef) && !e.imageRef.startsWith('shipbuild/')) {
      candidates.push({ imageRef: e.imageRef, app: e.app, addedAt: e.addedAt });
    }
  }
  // secondary: recent history (covers entries the ledger may have lost before its introduction)
  const apps = (await readdir(appsRoot, { withFileTypes: true }).catch(() => [])).filter((e) => e.isDirectory());
  const seen = new Set(candidates.map((c) => c.imageRef));
  for (const e of apps) {
    const state = await store.loadState(e.name).catch(() => null);
    for (const h of state?.history ?? []) {
      if (!protectedSet.has(h.imageRef) && !seen.has(h.imageRef) && !h.imageRef.startsWith('shipbuild/')) {
        seen.add(h.imageRef);
        candidates.push({ imageRef: h.imageRef, app: e.name, addedAt: h.at });
      }
    }
  }
  return { protectedRefs: [...protectedSet].sort(), candidates };
}

export interface GcResult {
  removed: string[];
  skippedProtected: string[];
  missing: string[];
  failed: Array<{ imageRef: string; error: string }>;
}

export async function executeImageGc(
  appsRoot: string,
  plan: GcPlan,
  log: (line: string) => void,
  run: DockerRun = defaultDockerRun,
): Promise<GcResult> {
  // writer slot: mutually exclusive with every deploy/rollback for the entire compute+delete window (RA02)
  return withGcSlot(async () => {
    const result: GcResult = { removed: [], skippedProtected: [], missing: [], failed: [] };
    const store = new ReleaseStore(appsRoot);
    const ledger = new ImageLedger(ledgerFileFor(appsRoot));
    // protection recomputed INSIDE the writer slot — nothing can shift references from here on,
    // and a release published between preview and execute is protected before the first rmi
    const live = await protectedRefs(appsRoot, store);
    for (const c of plan.candidates) {
      if (live.has(c.imageRef) || c.imageRef.startsWith('shipbuild/')) {
        result.skippedProtected.push(c.imageRef);
        continue;
      }
      const inspect = await run(['image', 'inspect', c.imageRef, '--format', '{{.Id}}']);
      if (inspect.code !== 0) {
        const detail = `${inspect.stderr.trim().slice(0, 160)}${inspect.timedOut ? ' (timed out)' : ''}`;
        if (!inspect.timedOut && NOT_FOUND_RE.test(inspect.stderr)) {
          result.missing.push(c.imageRef);
          await ledger.remove(c.imageRef);
          log(`confirmed absent: ${c.imageRef}`);
        } else {
          result.failed.push({ imageRef: c.imageRef, error: `docker inspect: ${detail}` });
        }
        continue;
      }
      const rmi = await run(['rmi', c.imageRef]);
      if (rmi.code === 0) {
        result.removed.push(c.imageRef);
        await ledger.remove(c.imageRef);
        log(`removed: ${c.imageRef}`);
      } else {
        const detail = `${rmi.stderr.trim().slice(0, 160)}${rmi.timedOut ? ' (timed out)' : ''}`;
        result.failed.push({ imageRef: c.imageRef, error: `docker rmi: ${detail}` });
      }
    }
    return result;
  });
}

/** previews also take a reader slot so they never observe a half-shifted state */
export async function previewImageGc(appsRoot: string): Promise<GcPlan> {
  return withDeploySlot(() => planImageGc(appsRoot));
}
