import { mkdirSync, closeSync, openSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const appRoot = fileURLToPath(new URL('..', import.meta.url));
const dataRoot = path.resolve(process.env.SHIPKIT_DATA_DIR ?? path.join(appRoot, '.data'));
const databaseUrl = process.env.DATABASE_URL ?? `file:${path.join(dataRoot, 'platform.db')}`;
if (!databaseUrl.startsWith('file:')) throw new Error('Shipkit local database requires a SQLite file URL');
const databaseFile = databaseUrl.slice(5);
if (!path.isAbsolute(databaseFile)) throw new Error('DATABASE_URL must use an absolute SQLite path');
mkdirSync(path.dirname(databaseFile), { recursive: true, mode: 0o700 });
closeSync(openSync(databaseFile, 'a', 0o600));
const result = spawnSync('pnpm', ['exec', 'prisma', 'migrate', 'deploy'], {
  cwd: appRoot, stdio: 'inherit', env: { ...process.env, DATABASE_URL: databaseUrl },
});
process.exitCode = result.status ?? 1;
