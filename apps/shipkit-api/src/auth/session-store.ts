import { Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { DatabaseService } from '../database/database.service.js';
import type { SessionView } from './contracts.js';
import { pruneInvalidSession, readSessionSnapshot, validSessionSnapshot } from './session-read.js';

export const unauthorized = () => new UnauthorizedException('登录凭据无效或会话已失效');
@Injectable()
export class SessionStore {
  constructor(@Inject(DatabaseService) private readonly db: DatabaseService) {}
  async create(actorId: string, passwordHash: string, hash: string, expiresAt: Date, requestId: string): Promise<SessionView> {
    return this.db.$transaction(async tx => {
      const actor = await tx.actor.findUnique({ where: { id: actorId } });
      if (!actor || actor.disabled || actor.passwordHash !== passwordHash || !actor.username || actor.kind !== 'user') throw unauthorized();
      await tx.authSession.create({ data: { id: hash, actorId, expiresAt } });
      await tx.audit.create({ data: { actorId, workspaceId: 'local', requestId, action: 'auth.login', resourceType: 'actor', resourceId: actorId, outcome: 'succeeded' } });
      return { user: { id: actor.id, username: actor.username, displayName: actor.name }, expiresAt: expiresAt.toISOString() };
    });
  }
  async read(hash: string): Promise<SessionView | null> {
    const session = await readSessionSnapshot(this.db, hash);
    if (!session) return null;
    const now = new Date();
    if (!validSessionSnapshot(session, now)) {
      await pruneInvalidSession(this.db, session, now);
      return null;
    }
    return { user: { id: session.actorId, username: session.username!, displayName: session.name }, expiresAt: session.expiresAt.toISOString() };
  }
  async revoke(hash: string, requestId: string): Promise<void> {
    await this.db.$transaction(async tx => {
      const session = await tx.authSession.findUnique({ where: { id: hash } });
      await tx.authSession.deleteMany({ where: { id: hash } });
      if (session) await tx.audit.create({ data: { actorId: session.actorId, workspaceId: 'local', requestId, action: 'auth.logout', resourceType: 'actor', resourceId: session.actorId, outcome: 'succeeded' } });
    });
  }
}
