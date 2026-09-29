// Last-build records, keyed per app so a stale record can never deploy B's image into A (F01).

import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import type { LastBuildRecord } from '../shared/types.js';

function shipDir(): string {
  return path.join(process.env.HOME ?? '.', '.ship');
}

function fileFor(app: string): string {
  return path.join(shipDir(), `last-build-${app}.json`);
}

/** legacy single-record file from 0.1.x — read only when it belongs to this app */
function legacyFile(): string {
  return path.join(shipDir(), 'last-build.json');
}

export async function readLastBuild(app: string): Promise<LastBuildRecord | null> {
  for (const file of [fileFor(app), legacyFile()]) {
    try {
      const record = JSON.parse(await readFile(file, 'utf8')) as LastBuildRecord;
      if (record?.app === app && record.imageRef) return record;
    } catch {
      // absent or unreadable — try next source
    }
  }
  return null;
}

export async function saveLastBuild(record: LastBuildRecord): Promise<void> {
  await mkdir(shipDir(), { recursive: true });
  await writeFile(fileFor(record.app), JSON.stringify(record, null, 2), { mode: 0o600 });
}
