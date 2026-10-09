import { Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { DatabaseService } from '../database/database.service.js';
import type { SessionView } from './contracts.js';

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
    return this.db.$transaction(async tx => {
      const session = await tx.authSession.findUnique({ where: { id: hash }, include: { actor: true } });
      if (!session) return null;
      if (session.actor.disabled || session.actor.kind !== 'user' || !session.actor.username || !session.actor.passwordHash || session.expiresAt.getTime() <= Date.now()) {
        await tx.authSession.deleteMany({ where: session.actor.disabled ? { actorId: session.actorId } : { id: hash } });
        return null;
      }
      return { user: { id: session.actor.id, username: session.actor.username, displayName: session.actor.name }, expiresAt: session.expiresAt.toISOString() };
    });
  }
  async revoke(hash: string, requestId: string): Promise<void> {
    await this.db.$transaction(async tx => {
      const session = await tx.authSession.findUnique({ where: { id: hash } });
      await tx.authSession.deleteMany({ where: { id: hash } });
      if (session) await tx.audit.create({ data: { actorId: session.actorId, workspaceId: 'local', requestId, action: 'auth.logout', resourceType: 'actor', resourceId: session.actorId, outcome: 'succeeded' } });
    });
  }
}
