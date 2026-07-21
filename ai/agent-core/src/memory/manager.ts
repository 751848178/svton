import type { MemoryEntry } from './types';
import type { IStorage, IFileSystem } from '@svton/agent-platform';
import { snapshotMemoryEntries, snapshotMemoryEntry } from './memory-entry-snapshot.utils';
import { loadProjectMemoryEntries } from './project-memory-loader.service';
import { extractMemorableFacts } from './memory-extraction.service';
import { findRelevantMemoryEntries } from './memory-relevance.service';
import {
  formatAllMemoryText,
  formatAutoMemoryText,
  formatProjectMemoryText,
} from './memory-text.service';

const AUTO_MEMORY_INDEX = 'memory:auto:index';

export class MemoryManager {
  private projectEntries: MemoryEntry[] = [];
  private autoEntries: MemoryEntry[] = [];
  private storage: IStorage | null = null;
  private maxAutoEntries: number;

  constructor(config?: { maxAutoEntries?: number }) {
    this.maxAutoEntries = config?.maxAutoEntries ?? 50;
  }

  async init(storage: IStorage): Promise<void> {
    this.storage = storage;
    await this.loadAutoMemory();
  }

  async loadProjectMemory(
    fs: IFileSystem,
    startDir: string,
    fileName: string = 'AGENT.md',
  ): Promise<number> {
    const entries = await loadProjectMemoryEntries(fs, startDir, fileName);
    this.projectEntries = snapshotMemoryEntries(entries);
    return this.projectEntries.length;
  }

  addProjectMemory(content: string, source: string): void {
    this.projectEntries.push(snapshotMemoryEntry({
      key: `project:${source}`,
      content,
      scope: 'project',
      source,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    }));
  }

  async saveAutoMemory(content: string, source: string = 'auto'): Promise<void> {
    if (!this.storage) return;

    const entry: MemoryEntry = {
      key: `auto:${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      content,
      scope: 'session',
      source,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    this.autoEntries.push(snapshotMemoryEntry(entry));

    while (this.autoEntries.length > this.maxAutoEntries) {
      this.autoEntries.shift();
    }

    await this.persistAutoMemory();
  }

  async clearAutoMemory(): Promise<void> {
    this.autoEntries = [];
    if (this.storage) {
      await this.persistAutoMemory();
    }
  }

  async deleteEntry(key: string): Promise<void> {
    const wasInAuto = this.autoEntries.some((e) => e.key === key);
    this.autoEntries = this.autoEntries.filter((e) => e.key !== key);
    this.projectEntries = this.projectEntries.filter((e) => e.key !== key);
    if (wasInAuto && this.storage) {
      await this.persistAutoMemory();
    }
  }

  getProjectMemoryText(): string {
    return formatProjectMemoryText(this.projectEntries);
  }

  getAutoMemoryText(): string {
    return formatAutoMemoryText(this.autoEntries);
  }

  getAllMemoryText(): string {
    return formatAllMemoryText(
      this.getProjectMemoryText(),
      this.getAutoMemoryText(),
    );
  }

  getAllEntries(): MemoryEntry[] {
    return snapshotMemoryEntries([...this.projectEntries, ...this.autoEntries]);
  }

  get hasMemory(): boolean {
    return this.projectEntries.length > 0 || this.autoEntries.length > 0;
  }

  async extractFromConversation(
    messages: Array<{ role: string; content: string }>,
    provider?: { chat: (msgs: any[], opts?: any) => AsyncGenerator<any> },
    model?: string,
  ): Promise<number> {
    if (!provider || !model || messages.length < 4) return 0;

    try {
      const facts = await extractMemorableFacts(
        messages,
        provider,
        model,
        this.getAutoMemoryText(),
      );

      let saved = 0;
      for (const fact of facts) {
        const exists = this.autoEntries.some(e =>
          e.content.toLowerCase().includes(fact.toLowerCase().slice(0, 40))
        );
        if (!exists) {
          await this.saveAutoMemory(fact, 'auto-extract');
          saved++;
        }
      }

      return saved;
    } catch {
      return 0; // Non-fatal — extraction failure shouldn't break the conversation
    }
  }

  getRelevantMemories(userMessage: string, limit: number = 5): MemoryEntry[] {
    return snapshotMemoryEntries(
      findRelevantMemoryEntries(this.autoEntries, userMessage, limit),
    );
  }

  private async loadAutoMemory(): Promise<void> {
    if (!this.storage) return;

    const entries = await this.storage.get<MemoryEntry[]>(AUTO_MEMORY_INDEX);
    if (entries && Array.isArray(entries)) {
      this.autoEntries = snapshotMemoryEntries(entries);
    }
  }

  private async persistAutoMemory(): Promise<void> {
    if (!this.storage) return;

    await this.storage.set(AUTO_MEMORY_INDEX, snapshotMemoryEntries(this.autoEntries));
  }
}
