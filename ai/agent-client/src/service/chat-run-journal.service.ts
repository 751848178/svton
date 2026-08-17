import type { IStorage } from '@svton/agent-platform';
import { ChatRunJournalRepository } from './chat-run-journal.repository';
import { toJournalRecord, type ChatRunJournalRecord } from './chat-run-journal.types';
import type { SessionRunState } from './chat-run.types';

/** Per-session serialized journal I/O with epoch/tombstone deletion safety. */
export class ChatRunJournalService {
  private storage: IStorage | null = null;
  private repository: ChatRunJournalRepository | null = null;
  private configurationEpoch = 0;
  private readonly tails = new Map<string, Promise<void>>();
  private readonly epochs = new Map<string, number>();
  private readonly tombstones = new Set<string>();

  configure(storage: IStorage): void {
    if (this.storage === storage) return;
    this.storage = storage;
    this.configurationEpoch += 1;
    this.repository = new ChatRunJournalRepository(storage);
    this.tails.clear();
    this.epochs.clear();
    this.tombstones.clear();
  }

  async load(sessionId: string): Promise<ChatRunJournalRecord | null> {
    await this.flush(sessionId);
    if (this.tombstones.has(sessionId)) return null;
    return this.repository?.load(sessionId) ?? null;
  }

  persist(state: SessionRunState): Promise<void> {
    const record = toJournalRecord(state);
    if (!record || this.tombstones.has(record.state.sessionId)) return Promise.resolve();
    const sessionId = record.state.sessionId;
    const epoch = this.epoch(sessionId);
    const configurationEpoch = this.configurationEpoch;
    const repository = this.repository;
    return this.enqueue(sessionId, async () => {
      if (this.configurationEpoch !== configurationEpoch
        || this.epoch(sessionId) !== epoch
        || this.tombstones.has(sessionId)) return;
      await repository?.saveLatest(record);
    });
  }

  delete(sessionId: string): Promise<void> {
    this.tombstones.add(sessionId);
    this.epochs.set(sessionId, this.epoch(sessionId) + 1);
    const configurationEpoch = this.configurationEpoch;
    const repository = this.repository;
    return this.enqueue(sessionId, async () => {
      if (this.configurationEpoch !== configurationEpoch) return;
      await repository?.delete(sessionId);
    });
  }

  flush(sessionId: string): Promise<void> {
    return this.tails.get(sessionId) ?? Promise.resolve();
  }

  private enqueue(sessionId: string, task: () => Promise<void>): Promise<void> {
    const tail = (this.tails.get(sessionId) ?? Promise.resolve())
      .catch(() => {})
      .then(task);
    this.tails.set(sessionId, tail);
    void tail.finally(() => {
      if (this.tails.get(sessionId) === tail) this.tails.delete(sessionId);
    }).catch(() => {});
    return tail;
  }

  private epoch(sessionId: string): number {
    return this.epochs.get(sessionId) ?? 0;
  }
}
