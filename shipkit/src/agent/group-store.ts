// Group state + layout (multi-service v2): state.json references releases by
// id with parent/changedServices history; the v2 layout marker group.json
// distinguishes v2 groups from v1 single-app dirs — mixed layouts are refused,
// never migrated automatically. Snapshot payloads live in group-snapshots.ts.

import { mkdir, open, readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { isRecord } from '../shared/obj.js';
import { writeFileAtomic } from './atomic.js';
import { GroupSnapshots, validGroupReleaseId } from './group-snapshots.js';
import type { GroupRelease } from './group-store-types.js';

export type { GroupServiceEntry, GroupServiceSource, GroupRelease, GroupState } from './group-store-types.js';

export class GroupStore {
  readonly snapshots: GroupSnapshots;
  constructor(private readonly appsRoot: string) {
    this.snapshots = new GroupSnapshots(appsRoot);
  }

  appDir(group: string): string { return path.join(this.appsRoot, group); }
  servicesDir(group: string, service: string): string { return path.join(this.appDir(group), 'services', service); }
  private stateFile(group: string): string { return path.join(this.appDir(group), 'state.json'); }
  private markerFile(group: string): string { return path.join(this.appDir(group), 'group.json'); }

  /** refuse when the directory holds v1 single-app evidence: any entry without
   *  our v2 marker means this name was used by the v1 layout (or an unknown
   *  actor) — explicit migration only, we never auto-claim */
  async assertLayout(group: string): Promise<void> {
    let entries: string[];
    try {
      entries = await readdir(this.appDir(group));
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code === 'ENOENT') return; // genuinely fresh
      throw new Error(`无法读取目录 ${this.appDir(group)}（${(e as Error).message}）— 拒绝执行，请人工检查`);
    }
    if (entries.length === 0) return;
    if (!entries.includes('group.json')) {
      throw new Error(
        `应用名 '${group}' 已有 v1 单服务部署痕迹（${entries.join('、')}）— v2 多服务协议不会自动接管；` +
        '请人工核对后显式迁移（迁移说明见 docs/multi-service.md），或为发布组更换名称',
      );
    }
    let parsed: unknown;
    try {
      parsed = JSON.parse(await readFile(this.markerFile(group), 'utf8'));
    } catch {
      throw new Error(`组标记 ${this.markerFile(group)} 损坏或不可读 — 原文件已保留，请人工检查`);
    }
    if (!isRecord(parsed) || parsed.schemaVersion !== 2) {
      throw new Error(`组标记 ${this.markerFile(group)} 内容非法（需 {"schemaVersion":2}）— 原文件已保留，请人工检查`);
    }
  }

  /** claim the v2 layout marker; call only AFTER the project binding is verified */
  async claimLayout(group: string): Promise<void> {
    await mkdir(this.appDir(group), { recursive: true });
    try {
      const handle = await open(this.markerFile(group), 'wx', 0o600);
      try {
        await handle.writeFile(`${JSON.stringify({ schemaVersion: 2, at: new Date().toISOString() })}\n`);
      } finally {
        await handle.close();
      }
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code !== 'EEXIST') throw e;
    }
  }

  async loadState(group: string): Promise<import('./group-store-types.js').GroupState> {
    let text: string;
    try {
      text = await readFile(this.stateFile(group), 'utf8');
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code === 'ENOENT') return { schemaVersion: 2, current: null, previous: null, history: [] };
      throw new Error(`cannot read group state of '${group}': ${(e as Error).message}`);
    }
    try {
      const state: unknown = JSON.parse(text);
      if (!GroupStore.validState(state)) throw new Error('invalid state structure');
      return state as import('./group-store-types.js').GroupState;
    } catch (e) {
      throw new Error(`group state.json of '${group}' is corrupt (${(e as Error).message}); preserve it and restore from verified release records`);
    }
  }

  private static validState(v: unknown): boolean {
    const validId = (x: unknown) => x === null || validGroupReleaseId(x);
    if (!isRecord(v) || v.schemaVersion !== 2 || !validId(v.current) || !validId(v.previous) || !Array.isArray(v.history)) return false;
    if (v.updatedAt !== undefined && typeof v.updatedAt !== 'string') return false;
    return v.history.every((h) => isRecord(h) && validGroupReleaseId(h.releaseId) &&
      Array.isArray(h.changedServices) && h.changedServices.every((s) => typeof s === 'string') &&
      typeof h.at === 'string' && (h.event === 'deploy' || h.event === 'rollback'));
  }

  saveRelease(group: string, data: Omit<GroupRelease, 'id' | 'createdAt'>): Promise<GroupRelease> {
    return this.snapshots.save(group, data);
  }

  loadRelease(group: string, id: string): Promise<GroupRelease> {
    return this.snapshots.load(group, id);
  }

  async shift(group: string, releaseId: string, event: 'deploy' | 'rollback', beforeCommit?: () => Promise<void>): Promise<{ cleanupError?: string }> {
    const s = await this.loadState(group);
    const rel = await this.loadRelease(group, releaseId);
    if (s.current && s.current !== releaseId) s.previous = s.current;
    s.current = releaseId;
    s.updatedAt = new Date().toISOString();
    s.history.unshift({ releaseId, changedServices: rel.changedServices, at: s.updatedAt, event });
    s.history = s.history.slice(0, 20);
    // All awaited metadata reads have completed; the orchestrator's read-only
    // ownership gate must run immediately before the one state write.
    await beforeCommit?.();
    await writeFileAtomic(this.stateFile(group), JSON.stringify(s, null, 2), undefined, beforeCommit);
    try {
      await this.snapshots.gc(group, [s.current, s.previous]);
    } catch (e) {
      return { cleanupError: (e as Error).message };
    }
    return {};
  }

  /** groups for /api/status — corrupt state never crashes the status route */
  async list(): Promise<Array<{ app: string; currentReleaseId: string | null; updatedAt?: string }>> {
    const entries = await readdir(this.appsRoot, { withFileTypes: true }).catch(() => []);
    const groups: Array<{ app: string; currentReleaseId: string | null; updatedAt?: string }> = [];
    for (const e of entries) {
      if (!e.isDirectory()) continue;
      const isV2 = await readFile(path.join(this.appsRoot, e.name, 'group.json'), 'utf8')
        .then((t) => (JSON.parse(t) as { schemaVersion?: number }).schemaVersion === 2)
        .catch(() => false);
      if (!isV2) continue;
      const s = await this.loadState(e.name).catch(() => null);
      groups.push({ app: e.name, currentReleaseId: s?.current ?? null, updatedAt: s?.updatedAt });
    }
    return groups.sort((a, b) => a.app.localeCompare(b.app));
  }
}
