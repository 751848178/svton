import { Inject, Injectable } from '@nestjs/common';
import { randomBytes } from 'node:crypto';
import type { LocalRequest } from '../policy/request-context.js';
import { DatabaseService } from '../database/database.service.js';
import { username } from './accounts.js';
import { DUMMY_HASH, verifyPassword } from './password.js';
import { SessionStore, unauthorized } from './session-store.js';
import { AuthSettings } from './settings.js';
import { readSessionCookie, sessionHash } from './cookie.js';
import { LoginBudget } from './login-budget.js';

@Injectable()
export class AuthService {
  constructor(@Inject(DatabaseService) private readonly db: DatabaseService,
    @Inject(SessionStore) private readonly sessions: SessionStore,
    @Inject(AuthSettings) private readonly settings: AuthSettings,
    @Inject(LoginBudget) private readonly budget: LoginBudget) {}
  async login(body: Record<string, unknown>, request: LocalRequest) {
    const input = body && typeof body === 'object' && !Array.isArray(body) ? body : {};
    const name = username(input.username);
    this.budget.consume(request.socket.remoteAddress ?? 'local', name ?? 'invalid');
    const actor = name ? await this.db.actor.findUnique({ where: { username: name } }) : null;
    const valid = await verifyPassword(input.password, actor?.passwordHash ?? DUMMY_HASH);
    if (!valid || !actor?.passwordHash || actor.disabled || actor.kind !== 'user') throw unauthorized();
    const token = randomBytes(32).toString('base64url');
    const expiresAt = new Date(Date.now() + this.settings.sessionMs);
    const view = await this.sessions.create(actor.id, actor.passwordHash, sessionHash(token), expiresAt, request.localContext.requestId);
    return { view, token };
  }
  async authenticate(request: LocalRequest) {
    const token = readSessionCookie(request.headers.cookie); if (!token) throw unauthorized();
    const hash = sessionHash(token), view = await this.sessions.read(hash); if (!view) throw unauthorized();
    return { sessionHash: hash, view };
  }
  async logout(request: LocalRequest): Promise<void> {
    const token = readSessionCookie(request.headers.cookie);
    if (token) await this.sessions.revoke(sessionHash(token), request.localContext.requestId);
  }
}
