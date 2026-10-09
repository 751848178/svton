import { existsSync, statSync } from 'node:fs';
import path from 'node:path';
import { PrismaClient } from '../../generated/client/index.js';

/** Explicit init may create a first key, never replace lost decryption material. */
export async function assertNoEncryptedData(): Promise<void> {
  if (!process.env.DATABASE_URL && !process.env.SHIPKIT_DATA_DIR) throw new Error('Explicit database or data directory required');
  const url = process.env.DATABASE_URL ?? `file:${path.resolve(process.env.SHIPKIT_DATA_DIR ?? '.data', 'platform.db')}`;
  if (!url.startsWith('file:')) throw new Error('Cannot verify encrypted data');
  const file = url.slice(5).split('?')[0]!;
  if (!path.isAbsolute(file)) throw new Error('Absolute database URL required');
  if (!existsSync(file) || statSync(file).size === 0) return;
  const db = new PrismaClient({ datasources: { db: { url } } });
  try {
    for (const [table, column] of [['ConfigDraft', 'servicesJson'], ['ConfigVersion', 'servicesJson'], ['Project', 'repositorySecret'], ['Plan', 'privateSnapshot']]) {
      const tables = await db.$queryRawUnsafe<Array<{ name: string }>>('SELECT name FROM sqlite_master WHERE type = ? AND name = ?', 'table', table);
      if (!tables.length) continue;
      const columns = await db.$queryRawUnsafe<Array<{ name: string }>>(`PRAGMA table_info("${table}")`);
      if (!columns.some((item) => item.name === column)) continue;
      const rows = await db.$queryRawUnsafe<unknown[]>(`SELECT 1 FROM "${table}" WHERE "${column}" IS NOT NULL AND "${column}" <> '' LIMIT 1`);
      if (rows.length) throw new Error('Encrypted data already exists');
    }
  } finally { await db.$disconnect(); }
}
