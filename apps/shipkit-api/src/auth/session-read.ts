import type { DatabaseService } from '../database/database.service.js';

interface SessionSnapshot {
  id: string;
  actorId: string;
  expiresAt: Date;
  disabled: boolean;
  kind: string;
  username: string | null;
  name: string;
  hasPassword: bigint;
}

/** One SQLite statement binds the session and Actor without an interactive write lock. */
export async function readSessionSnapshot(db: DatabaseService, hash: string): Promise<SessionSnapshot | null> {
  const rows = await db.$queryRaw<SessionSnapshot[]>`
    SELECT s.id, s.actorId, s.expiresAt, a.disabled, a.kind, a.username, a.name,
      (a.passwordHash IS NOT NULL AND a.passwordHash <> '') AS hasPassword
    FROM AuthSession AS s INNER JOIN Actor AS a ON a.id = s.actorId
    WHERE s.id = ${hash} LIMIT 1
  `;
  return rows[0] ?? null;
}

export function validSessionSnapshot(row: SessionSnapshot, now: Date): boolean {
  return !row.disabled && row.kind === 'user' && !!row.username && !!row.hasPassword && row.expiresAt.getTime() > now.getTime();
}

/** Random session hashes are never reused; conditions also protect repaired/replaced rows. */
export async function pruneInvalidSession(db: DatabaseService, row: SessionSnapshot, now: Date): Promise<void> {
  const invalidActor = { OR: [{ disabled: true }, { kind: { not: 'user' } }, { username: null }, { username: '' }, { passwordHash: null }, { passwordHash: '' }] };
  const where = row.disabled
    ? { actorId: row.actorId, actor: { disabled: true } }
    : { id: row.id, actorId: row.actorId, expiresAt: row.expiresAt, OR: [{ expiresAt: { lte: now } }, { actor: invalidActor }] };
  await db.authSession.deleteMany({ where });
}
