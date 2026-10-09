import { Injectable, HttpException } from '@nestjs/common';

@Injectable()
export class LoginBudget {
  private readonly entries = new Map<string, { count: number; until: number }>();
  consume(peer: string, username: string): void {
    const now = Date.now();
    for (const [key, entry] of this.entries) if (entry.until <= now) this.entries.delete(key);
    if (this.entries.size >= 2000) throw new HttpException('登录暂不可用，请稍后再试', 429);
    for (const [key, limit] of [[`peer:${peer}`, 50], [`name:${username}`, 10]] as const) {
      const entry = this.entries.get(key) ?? { count: 0, until: now + 10 * 60_000 };
      if (entry.count >= limit) throw new HttpException('登录暂不可用，请稍后再试', 429);
      entry.count++; this.entries.set(key, entry);
    }
  }
}
