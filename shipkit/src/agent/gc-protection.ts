// GC protection set (R08): every image referenced by ANY retained snapshot of
// ANY deployment on this machine is protected — v1 single apps AND v2 groups
// side by side. Strictly fail-closed: unreadable/corrupt state, an unreadable
// or ambiguous layout marker, or a corrupt retained snapshot aborts the whole
// GC (never "unknown ⇒ deletable").

import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { isRecord } from '../shared/obj.js';
import { ReleaseStore } from './release.js';
import { GroupStore } from './group-store.js';

async function isV2Group(appDir: string): Promise<boolean | 'ambiguous'> {
  let text: string;
  try {
    text = await readFile(path.join(appDir, 'group.json'), 'utf8');
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === 'ENOENT') return false; // plain v1 app dir
    throw new Error(`GC aborted: cannot read layout marker ${path.join(appDir, 'group.json')}: ${(e as Error).message}`);
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return 'ambiguous';
  }
  if (!isRecord(parsed) || parsed.schemaVersion !== 2) return 'ambiguous';
  return true;
}

/** entries that look like release ids; anything else (stray files, editor
 *  droppings) is not a snapshot and is skipped — it neither protects nor
 *  endangers images. Id-SHAPED entries still load strictly below. */
async function retainedReleaseIds(appsRoot: string, app: string): Promise<string[]> {
  try {
    const entries = await readdir(path.join(appsRoot, app, 'releases'));
    return entries.filter((id) => /^[a-z0-9-]{6,40}$/.test(id));
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code !== 'ENOENT') throw new Error(`GC aborted: cannot read releases of '${app}': ${(e as Error).message}`);
    return [];
  }
}

/** strict: throws on any unreadable/corrupt state or retained snapshot (RA01/R08) */
export async function protectedRefs(appsRoot: string): Promise<Set<string>> {
  const protectedSet = new Set<string>();
  const v1Store = new ReleaseStore(appsRoot);
  const groupStore = new GroupStore(appsRoot);
  let appDirs: string[];
  try {
    appDirs = (await readdir(appsRoot, { withFileTypes: true })).filter((e) => e.isDirectory()).map((e) => e.name);
  } catch (e) {
    // a machine that never deployed anything has no apps root — that is empty, not corruption
    if ((e as NodeJS.ErrnoException).code === 'ENOENT') return protectedSet;
    throw new Error(`GC aborted: cannot read apps root ${appsRoot}: ${(e as Error).message}`);
  }
  for (const app of appDirs) {
    const appDir = path.join(appsRoot, app);
    const layout = await isV2Group(appDir);
    if (layout === 'ambiguous') {
      throw new Error(`GC aborted: layout marker of '${app}' is corrupt — cannot decide v1/v2, refusing to compute deletable images`);
    }
    if (layout) {
      // v2 group: protect EVERY service image of EVERY retained combination
      // (current/previous plus all snapshots still on disk — rollback sources)
      const state = await groupStore.loadState(app);
      const ids = new Set<string>([state.current, state.previous].filter(Boolean) as string[]);
      for (const id of await retainedReleaseIds(appsRoot, app)) ids.add(id);
      for (const id of ids) {
        const rel = await groupStore.loadRelease(app, id); // corrupt → throws → GC aborts
        for (const entry of Object.values(rel.services)) protectedSet.add(entry.imageRef);
      }
    } else {
      const state = await v1Store.loadState(app); // corrupt → throws
      for (const id of [state.current, state.previous]) {
        if (!id) continue;
        protectedSet.add((await v1Store.loadRelease(app, id)).imageRef);
      }
      for (const id of await retainedReleaseIds(appsRoot, app)) {
        protectedSet.add((await v1Store.loadRelease(app, id)).imageRef);
      }
    }
  }
  return protectedSet;
}
