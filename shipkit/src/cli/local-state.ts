// Last-build records, scoped per (app, project) so a stale or foreign record
// can never deploy B's image into A (F01) — and a different repo with the
// SAME app name can never reuse this project's image either. v2 groups add a
// service dimension: records are scoped per (group, project, service).

import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

export interface LastBuildRecord {
  app: string;
  /** owning project identity — records are scoped per (app, project); a
   *  different repo with the same app name can never reuse this image */
  project: string;
  /** v2 groups: which service of the group this image belongs to */
  service?: string;
  imageRef: string;
  tag: string;
  digest?: string;
  at: string;
  builderUrl: string;
}

function shipDir(): string {
  return path.join(process.env.HOME ?? '.', '.ship');
}

/** identity-scoped file name — same app under different projects never share */
function fileFor(app: string, project: string, service?: string): string {
  const key = createHash('sha256').update(`${project}\u0000${app}\u0000${service ?? ''}`).digest('hex').slice(0, 16);
  return path.join(shipDir(), `last-build-${app}.${key}.json`);
}

/** legacy per-app file (0.2.x) — readable ONLY when it already carries THIS
 *  project's identity; unscoped legacy records are never reused across
 *  projects (an unknown-owner record must not leak images between repos) */
function legacyFile(app: string): string {
  return path.join(shipDir(), `last-build-${app}.json`);
}

function recordMatches(record: LastBuildRecord, app: string, project: string, service?: string): boolean {
  if (record?.app !== app || record.project !== project || !record.imageRef) return false;
  return service === undefined ? record.service === undefined : record.service === service;
}

export async function readLastBuild(app: string, project: string, service?: string): Promise<LastBuildRecord | null> {
  const candidates = service === undefined ? [fileFor(app, project), legacyFile(app)] : [fileFor(app, project, service)];
  for (const file of candidates) {
    try {
      const record = JSON.parse(await readFile(file, 'utf8')) as LastBuildRecord;
      if (recordMatches(record, app, project, service)) return record;
    } catch {
      // absent or unreadable — try next source
    }
  }
  return null;
}

export async function saveLastBuild(record: LastBuildRecord): Promise<void> {
  if (typeof record.project !== 'string' || !record.project) {
    throw new Error('last-build record requires a project identity — refusing to write an unscoped record');
  }
  await mkdir(shipDir(), { recursive: true });
  await writeFile(fileFor(record.app, record.project, record.service), JSON.stringify(record, null, 2), { mode: 0o600 });
}
