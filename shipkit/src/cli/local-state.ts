// Last-build records, scoped per (app, project) so a stale or foreign record
// can never deploy B's image into A (F01) — and a different repo with the
// SAME app name can never reuse this project's image either.

import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import type { LastBuildRecord } from '../shared/types.js';

function shipDir(): string {
  return path.join(process.env.HOME ?? '.', '.ship');
}

/** identity-scoped file name — same app under different projects never share */
function fileFor(app: string, project: string): string {
  const key = createHash('sha256').update(`${project}\u0000${app}`).digest('hex').slice(0, 16);
  return path.join(shipDir(), `last-build-${app}.${key}.json`);
}

/** legacy per-app file (0.2.x) — readable ONLY when it already carries THIS
 *  project's identity; unscoped legacy records are never reused across
 *  projects (an unknown-owner record must not leak images between repos) */
function legacyFile(app: string): string {
  return path.join(shipDir(), `last-build-${app}.json`);
}

export async function readLastBuild(app: string, project: string): Promise<LastBuildRecord | null> {
  for (const file of [fileFor(app, project), legacyFile(app)]) {
    try {
      const record = JSON.parse(await readFile(file, 'utf8')) as LastBuildRecord;
      if (record?.app === app && record.project === project && record.imageRef) return record;
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
  await writeFile(fileFor(record.app, record.project), JSON.stringify(record, null, 2), { mode: 0o600 });
}
