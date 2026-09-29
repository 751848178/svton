// Release store: every deploy saves an immutable snapshot (image + spec + env) under releases/<id> (F02/F33).
// state.json references releases by id; rollback re-activates the previous SNAPSHOT, not just its image.

import { readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import path from 'node:path';
import type { AppStatus, ShipSpec } from '../shared/types.js';
import { validateSpec } from '../shared/spec-schema.js';
import { writeFileAtomic } from './atomic.js';

export interface AppRelease {
  id: string;
  imageRef: string;
  spec: ShipSpec;
  env?: string;
  createdAt: string;
}

export interface AppState {
  current: string | null;
  previous: string | null;
  updatedAt?: string;
  history: { releaseId: string; imageRef: string; at: string; event: 'deploy' | 'rollback' }[];
}

const EMPTY = (): AppState => ({ current: null, previous: null, history: [] });
const KEEP_RELEASES = 10;
const RELEASE_ID_RE = /^[a-z0-9-]{6,40}$/;

export class ReleaseStore {
  constructor(private readonly appsRoot: string) {}

  appDir(app: string): string {
    return path.join(this.appsRoot, app);
  }

  private releasesDir(app: string): string {
    return path.join(this.appDir(app), 'releases');
  }

  private stateFile(app: string): string {
    return path.join(this.appDir(app), 'state.json');
  }

  /** strict load: only ENOENT means "never deployed"; corruption/permission errors are surfaced (F33) */
  async loadState(app: string): Promise<AppState> {
    let text: string;
    try {
      text = await readFile(this.stateFile(app), 'utf8');
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code === 'ENOENT') return EMPTY();
      throw new Error(`cannot read state of '${app}': ${(e as Error).message}`);
    }
    try {
      return { ...EMPTY(), ...(JSON.parse(text) as AppState) };
    } catch (e) {
      throw new Error(`state.json of '${app}' is corrupt (${(e as Error).message}); restore from releases/ or delete it to reset`);
    }
  }

  async saveRelease(app: string, imageRef: string, spec: ShipSpec, env?: string): Promise<AppRelease> {
    const id = `${Date.now().toString(36)}-${randomUUID().slice(0, 8)}`;
    const dir = path.join(this.releasesDir(app), id);
    const createdAt = new Date().toISOString();
    await writeFileAtomic(path.join(dir, 'meta.json'), JSON.stringify({ id, imageRef, createdAt, spec }, null, 2));
    if (env !== undefined) await writeFile(path.join(dir, 'env'), env, { mode: 0o600 });
    return { id, imageRef, spec, env, createdAt };
  }

  async loadRelease(app: string, id: string): Promise<AppRelease> {
    if (!RELEASE_ID_RE.test(id)) throw new Error(`invalid release id '${id}'`);
    const dir = path.join(this.releasesDir(app), id);
    const meta = JSON.parse(await readFile(path.join(dir, 'meta.json'), 'utf8')) as { id: string; imageRef: string; createdAt: string; spec: unknown };
    let env: string | undefined;
    try {
      env = await readFile(path.join(dir, 'env'), 'utf8');
    } catch {
      // release without env snapshot
    }
    return { id, imageRef: meta.imageRef, spec: validateSpec(meta.spec), env, createdAt: meta.createdAt };
  }

  async shift(app: string, releaseId: string, event: 'deploy' | 'rollback'): Promise<void> {
    const s = await this.loadState(app);
    const rel = await this.loadRelease(app, releaseId);
    if (s.current && s.current !== releaseId) s.previous = s.current;
    s.current = releaseId;
    s.updatedAt = new Date().toISOString();
    s.history.unshift({ releaseId, imageRef: rel.imageRef, at: s.updatedAt, event });
    s.history = s.history.slice(0, 20);
    await writeFileAtomic(this.stateFile(app), JSON.stringify(s, null, 2));
    await this.gc(app, s);
  }

  private async gc(app: string, state: AppState): Promise<void> {
    const dir = this.releasesDir(app);
    const ids = (await readdir(dir).catch(() => [] as string[])).sort();
    const protectedIds = new Set([state.current, state.previous].filter(Boolean) as string[]);
    const removable = ids.filter((id) => !protectedIds.has(id));
    const excess = removable.slice(0, Math.max(0, removable.length - KEEP_RELEASES));
    for (const id of excess) await rm(path.join(dir, id), { recursive: true, force: true });
  }

  async list(): Promise<AppStatus[]> {
    const entries = await readdir(this.appsRoot, { withFileTypes: true }).catch(() => []);
    const apps: AppStatus[] = [];
    for (const e of entries) {
      if (!e.isDirectory() || e.name === 'releases') continue;
      const s = await this.loadState(e.name).catch(() => null);
      if (!s) continue;
      const cur = s.current ? await this.loadRelease(e.name, s.current).catch(() => null) : null;
      const prev = s.previous ? await this.loadRelease(e.name, s.previous).catch(() => null) : null;
      apps.push({
        app: e.name,
        current: cur?.imageRef ?? null,
        previous: prev?.imageRef ?? null,
        currentReleaseId: s.current,
        previousReleaseId: s.previous,
        updatedAt: s.updatedAt,
      });
    }
    return apps.sort((a, b) => a.app.localeCompare(b.app));
  }
}
