import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { DatabaseService } from '../database/database.service.js';

export async function databaseFixture() {
  const directory = await mkdtemp(path.join(tmpdir(), 'shipkit-api-test-'));
  const previousUrl = process.env.DATABASE_URL;
  const previousRoot = process.env.SHIPKIT_DATA_DIR;
  process.env.DATABASE_URL = `file:${path.join(directory, 'platform.db')}`;
  process.env.SHIPKIT_DATA_DIR = directory;
  await writeFile(path.join(directory, 'platform.db'), '', { mode: 0o600 });
  const migration = spawnSync('pnpm', ['exec', 'prisma', 'migrate', 'deploy'], { encoding: 'utf8', env: process.env });
  if (migration.status !== 0) throw new Error(`Isolated migration failed (${migration.status})`);
  const db = new DatabaseService();
  await db.onModuleInit();
  return { db, directory, dispose: async () => {
    await db.onModuleDestroy();
    if (previousUrl === undefined) delete process.env.DATABASE_URL; else process.env.DATABASE_URL = previousUrl;
    if (previousRoot === undefined) delete process.env.SHIPKIT_DATA_DIR; else process.env.SHIPKIT_DATA_DIR = previousRoot;
    await rm(directory, { recursive: true, force: true });
  } };
}
