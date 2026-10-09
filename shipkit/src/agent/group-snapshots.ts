// v2 group release snapshots (MS-03): immutable full-combination manifests
// with private per-service env files. Strict validation everywhere — corrupt
// metadata refuses and tells the operator to preserve + restore, never guess.

import { readFile, readdir, rm } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import path from 'node:path';
import { validateServiceSpec } from '../shared/spec-v2.js';
import { isRecord } from '../shared/obj.js';
import { writeFileAtomic } from './atomic.js';
import type { GroupServiceEntry, GroupServiceSource, GroupRelease } from './group-store-types.js';
import { validateConfigRef } from './group-config.js';

const KEEP_RELEASES = 10;
const RELEASE_ID_RE = /^[a-z0-9-]{6,40}$/;
const SERVICE_NAME_RE = /^[a-z][a-z0-9-]{0,62}$/;

export function validGroupReleaseId(id: unknown): boolean {
  return typeof id === 'string' && RELEASE_ID_RE.test(id);
}

export class GroupSnapshots {
  constructor(private readonly appsRoot: string) {}

  private releasesDir(group: string): string {
    return path.join(this.appsRoot, group, 'releases');
  }

  async save(group: string, data: Omit<GroupRelease, 'id' | 'createdAt'>): Promise<GroupRelease> {
    const id = `${Date.now().toString(36)}-${randomUUID().slice(0, 8)}`;
    const createdAt = new Date().toISOString();
    const dir = path.join(this.releasesDir(group), id);
    const services: Record<string, GroupServiceEntry> = {};
    for (const [name, entry] of Object.entries(data.services)) services[name] = { ...entry, env: undefined };
    await writeFileAtomic(path.join(dir, 'manifest.json'), JSON.stringify({ id, parent: data.parent, changedServices: data.changedServices, createdAt, services }, null, 2));
    for (const [name, entry] of Object.entries(data.services)) {
      if (entry.env !== undefined) {
        await writeFileAtomic(path.join(dir, 'env', name), entry.env, 0o600);
      }
    }
    return { id, parent: data.parent, changedServices: data.changedServices, createdAt, services: { ...data.services } };
  }

  async load(group: string, id: string): Promise<GroupRelease> {
    if (!RELEASE_ID_RE.test(id)) throw new Error(`invalid group release id '${id}'`);
    const dir = path.join(this.releasesDir(group), id);
    let manifest: unknown;
    try {
      manifest = JSON.parse(await readFile(path.join(dir, 'manifest.json'), 'utf8'));
    } catch (e) {
      throw new Error(`group release '${group}/${id}' manifest is unreadable (${(e as Error).message}); preserve it and restore from verified release records`);
    }
    if (!isRecord(manifest) || manifest.id !== id || typeof manifest.createdAt !== 'string' ||
      (manifest.parent !== null && !validGroupReleaseId(manifest.parent)) ||
      !Array.isArray(manifest.changedServices) || !isRecord(manifest.services) || Object.keys(manifest.services).length === 0) {
      throw new Error(`group release '${group}/${id}' manifest is corrupt; preserve and restore the snapshot`);
    }
    const snapshotServices = manifest.services;
    if (manifest.changedServices.some((name) => typeof name !== 'string' || !SERVICE_NAME_RE.test(name) || !(name in snapshotServices))) {
      throw new Error(`group release '${group}/${id}' changed service scope is corrupt`);
    }
    const services: Record<string, GroupServiceEntry> = {};
    for (const [name, raw] of Object.entries(manifest.services)) {
      if (!SERVICE_NAME_RE.test(name)) throw new Error(`group release '${group}/${id}' service name is outside the deployment scope`);
      if (!isRecord(raw) || typeof raw.imageRef !== 'string' || !raw.imageRef || /\s/.test(raw.imageRef) || typeof raw.hasEnv !== 'boolean') {
        throw new Error(`group release '${group}/${id}' service '${name}' entry is corrupt`);
      }
      let env: string | undefined;
      try {
        env = await readFile(path.join(dir, 'env', name), 'utf8');
      } catch (e) {
        if ((e as NodeJS.ErrnoException).code !== 'ENOENT') {
          throw new Error(`cannot read env snapshot of '${group}/${id}' service '${name}': ${(e as Error).message}`);
        }
        if (raw.hasEnv) {
          throw new Error(`env snapshot of '${group}/${id}' service '${name}' is missing (hasEnv=true) — preserve it and restore from the operator's records`);
        }
      }
      services[name] = {
        imageRef: raw.imageRef,
        spec: validateServiceSpec(name, raw.spec),
        hasEnv: raw.hasEnv,
        env,
        ...(isRecord(raw.source) && typeof raw.source.type === 'string' ? { source: raw.source as unknown as GroupServiceSource } : {}),
        ...(raw.configRef !== undefined ? { configRef: validateConfigRef(raw.configRef, name) } : {}),
      };
    }
    return {
      id, parent: manifest.parent as string | null, changedServices: manifest.changedServices as string[],
      createdAt: manifest.createdAt as string, services,
    };
  }

  /** retention: keep 10 releases beyond current+previous (best-effort after commit) */
  async gc(group: string, protectedIds: Array<string | null>): Promise<void> {
    const dir = this.releasesDir(group);
    const ids = (await readdir(dir).catch(() => [] as string[])).filter((id) => RELEASE_ID_RE.test(id)).sort();
    const protectedSet = new Set(protectedIds.filter(Boolean) as string[]);
    const removable = ids.filter((id) => !protectedSet.has(id));
    for (const id of removable.slice(0, Math.max(0, removable.length - KEEP_RELEASES))) {
      await rm(path.join(dir, id), { recursive: true, force: true });
    }
  }
}
