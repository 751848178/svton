import { Inject, Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { DatabaseService } from '../database/database.service.js';
import { hashPassword } from './password.js';

export function username(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const normalized = value.trim().toLowerCase();
  return /^[a-z0-9][a-z0-9_.-]{2,63}$/.test(normalized) ? normalized : null;
}
@Injectable()
export class AccountAdmin {
  constructor(@Inject(DatabaseService) private readonly db: DatabaseService) {}
  async upsert(input: string, password: string, displayName = input) {
    const name = username(input);
    if (!name || !displayName.trim() || displayName.length > 100) throw new Error('账号名或显示名称无效');
    const passwordHash = await hashPassword(password);
    return this.db.$transaction(async tx => {
      const actor = await tx.actor.upsert({ where: { username: name }, create: { id: randomUUID(), kind: 'user', name: displayName, username: name, passwordHash },
        update: { kind: 'user', name: displayName, passwordHash, disabled: false } });
      await tx.authSession.deleteMany({ where: { actorId: actor.id } });
      await tx.audit.create({ data: { workspaceId: 'local', actorId: 'local-controller', requestId: randomUUID(), action: 'auth.account.provision', resourceType: 'actor', resourceId: actor.id, outcome: 'succeeded' } });
      return { id: actor.id, username: name, displayName: actor.name };
    });
  }
  async disable(input: string): Promise<void> {
    const name = username(input); if (!name) throw new Error('账号名无效');
    await this.db.$transaction(async tx => {
      const actor = await tx.actor.update({ where: { username: name }, data: { disabled: true } });
      await tx.authSession.deleteMany({ where: { actorId: actor.id } });
      await tx.audit.create({ data: { workspaceId: 'local', actorId: 'local-controller', requestId: randomUUID(), action: 'auth.account.disable', resourceType: 'actor', resourceId: actor.id, outcome: 'succeeded' } });
    });
  }
}
