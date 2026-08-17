export class ChatSessionSettingsLeaseService {
  private readonly owners = new Map<string | null, string>();

  acquire(sessionId: string | null, requestId: string): boolean {
    if (this.owners.has(sessionId)) return false;
    this.owners.set(sessionId, requestId);
    return true;
  }

  release(sessionId: string | null, requestId: string): void {
    if (this.owners.get(sessionId) === requestId) this.owners.delete(sessionId);
  }

  isPending(sessionId: string | null): boolean {
    return this.owners.has(sessionId);
  }
}
