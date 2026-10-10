import { cp, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { DatabaseService } from '../database/database.service.js';

export const IDENTITY_MIGRATION = '2026101001_agent_registration';
const BASELINE = ['2026100801_initial', '2026100802_release_versions', '2026100901_auth_sessions', '2026100904_versioned_config'];

/** Uses only a new temporary DB and pinned pre-registration migration history. */
export async function identityMigrationFixture() {
  const directory = await mkdtemp(path.join(tmpdir(), 'shipkit-identity-migration-'));
  const schema = path.join(directory, 'prisma/schema');
  const migrations = path.join(directory, 'prisma/migrations');
  const url = `file:${path.join(directory, 'platform.db')}`;
  const previousUrl = process.env.DATABASE_URL, previousRoot = process.env.SHIPKIT_DATA_DIR;
  const connections = new Set<DatabaseService>();
  process.env.DATABASE_URL = url; process.env.SHIPKIT_DATA_DIR = directory;
  const invoke = (args: string[]) => spawnSync('pnpm', ['exec', 'prisma', ...args, '--schema', schema],
    { encoding: 'utf8', env: { ...process.env, DATABASE_URL: url } });
  const dispose = async () => {
    for (const db of connections) await db.onModuleDestroy();
    if (previousUrl === undefined) delete process.env.DATABASE_URL; else process.env.DATABASE_URL = previousUrl;
    if (previousRoot === undefined) delete process.env.SHIPKIT_DATA_DIR; else process.env.SHIPKIT_DATA_DIR = previousRoot;
    await rm(directory, { recursive: true, force: true });
  };
  try {
    await mkdir(migrations, { recursive: true }); await writeFile(url.slice(5), '', { mode: 0o600 });
    await cp('prisma/schema', schema, { recursive: true });
    await cp('prisma/migrations/migration_lock.toml', path.join(migrations, 'migration_lock.toml'));
    for (const name of BASELINE) await cp(path.join('prisma/migrations', name), path.join(migrations, name), { recursive: true });
    const baseline = invoke(['migrate', 'deploy']);
    if (baseline.status !== 0) throw new Error(`Isolated legacy migration failed (${baseline.status})`);
    return { directory, dispose, connect: async () => {
      const db = new DatabaseService(); connections.add(db); await db.onModuleInit(); return db;
    }, deploy: () => invoke(['migrate', 'deploy']), addIdentity: async (failBeforeCommit = false) => {
      const target = path.join(migrations, IDENTITY_MIGRATION); await mkdir(target, { recursive: true });
      const original = await readFile(`prisma/migrations/${IDENTITY_MIGRATION}/migration.sql`, 'utf8');
      if (!original.includes('BEGIN IMMEDIATE;') || original.split('COMMIT;').length !== 2) throw new Error('Missing single migration transaction');
      await writeFile(path.join(target, 'migration.sql'), failBeforeCommit
        ? original.replace('COMMIT;', 'SELECT * FROM "__identity_migration_fault__";\nCOMMIT;') : original);
    }, resolveRollback: () => invoke(['migrate', 'resolve', '--rolled-back', IDENTITY_MIGRATION]) };
  } catch (error) { await dispose(); throw error; }
}
