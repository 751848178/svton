import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { DatabaseService } from '../database/database.service.js';
import { AccountAdmin } from '../auth/accounts.js';
import { randomBytes } from 'node:crypto';

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
  const seedAccount = (name: string, password: string, displayName = name) => new AccountAdmin(db).upsert(name, password, displayName);
  const authenticatedFetch = async (base: string) => {
    const username = 'fixture-operator', password = randomBytes(24).toString('base64url');
    await seedAccount(username, password);
    const login = await fetch(`${base}/api/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-shipkit-local': '1' }, body: JSON.stringify({ username, password }) });
    if (!login.ok || !login.headers.get('set-cookie')) throw new Error('Explicit fixture login failed');
    const cookie = login.headers.get('set-cookie')!.split(';')[0]!;
    return (input: string | URL, options: RequestInit = {}) => {
      const headers = new Headers(options.headers); headers.set('cookie', cookie);
      return fetch(input, { ...options, headers });
    };
  };
  return { db, directory, seedAccount, authenticatedFetch, dispose: async () => {
    await db.onModuleDestroy();
    if (previousUrl === undefined) delete process.env.DATABASE_URL; else process.env.DATABASE_URL = previousUrl;
    if (previousRoot === undefined) delete process.env.SHIPKIT_DATA_DIR; else process.env.SHIPKIT_DATA_DIR = previousRoot;
    await rm(directory, { recursive: true, force: true });
  } };
}
