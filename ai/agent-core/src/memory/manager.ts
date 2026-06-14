import type { MemoryEntry, MemoryScope } from './types';
import type { IStorage, IFileSystem } from '@svton/agent-platform';

const AUTO_MEMORY_PREFIX = 'memory:auto:';
const AUTO_MEMORY_INDEX = 'memory:auto:index';

/**
 * Manages agent memory across sessions.
 *
 * Two types of memory:
 * 1. **Project Memory** - Rules, notes, and context from AGENT.md files
 *    (like CLAUDE.md in Claude Code). Loaded from files at session start.
 *
 * 2. **Auto Memory** - Patterns and preferences the agent learns across sessions.
 *    Persisted in storage. Automatically loaded and saved.
 */
export class MemoryManager {
  private projectEntries: MemoryEntry[] = [];
  private autoEntries: MemoryEntry[] = [];
  private storage: IStorage | null = null;
  private maxAutoEntries: number;

  constructor(config?: { maxAutoEntries?: number }) {
    this.maxAutoEntries = config?.maxAutoEntries ?? 50;
  }

  /**
   * Initialize with a storage backend for auto memory persistence.
   */
  async init(storage: IStorage): Promise<void> {
    this.storage = storage;
    await this.loadAutoMemory();
  }

  // ----------------------------------------------------------
  // Project Memory
  // ----------------------------------------------------------

  /**
   * Load project memory from AGENT.md-style files.
   * Walks up the directory tree from `startDir` loading files.
   */
  async loadProjectMemory(
    fs: IFileSystem,
    startDir: string,
    fileName: string = 'AGENT.md',
  ): Promise<number> {
    this.projectEntries = [];
    let count = 0;

    // Walk up from startDir to root
    let currentDir = startDir;
    const visited = new Set<string>();

    while (currentDir && !visited.has(currentDir)) {
      visited.add(currentDir);

      const filePath = fs.join(currentDir, fileName);

      try {
        const exists = await fs.exists(filePath);
        if (exists) {
          const content = await fs.readFile(filePath);
          if (content.trim()) {
            this.projectEntries.push({
              key: `project:${filePath}`,
              content: content.trim(),
              scope: 'project',
              source: filePath,
              createdAt: Date.now(),
              updatedAt: Date.now(),
            });
            count++;
          }
        }
      } catch {
        // File not readable, skip
      }

      // Move up one directory
      const parent = fs.dirname(currentDir);
      if (parent === currentDir) break; // reached root
      currentDir = parent;
    }

    // Reverse so root-level rules come first (lower priority), deeper rules last
    this.projectEntries.reverse();

    return count;
  }

  /**
   * Manually add a project memory entry.
   */
  addProjectMemory(content: string, source: string): void {
    this.projectEntries.push({
      key: `project:${source}`,
      content,
      scope: 'project',
      source,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });
  }

  // ----------------------------------------------------------
  // Auto Memory
  // ----------------------------------------------------------

  /**
   * Save an auto-learned memory entry.
   */
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

    this.autoEntries.push(entry);

    // Enforce max entries (remove oldest)
    while (this.autoEntries.length > this.maxAutoEntries) {
      this.autoEntries.shift();
    }

    await this.persistAutoMemory();
  }

  /**
   * Clear all auto memory.
   */
  async clearAutoMemory(): Promise<void> {
    this.autoEntries = [];
    if (this.storage) {
      await this.persistAutoMemory();
    }
  }

  /**
   * Delete a specific memory entry by its key.
   */
  async deleteEntry(key: string): Promise<void> {
    const wasInAuto = this.autoEntries.some((e) => e.key === key);
    this.autoEntries = this.autoEntries.filter((e) => e.key !== key);
    this.projectEntries = this.projectEntries.filter((e) => e.key !== key);
    if (wasInAuto && this.storage) {
      await this.persistAutoMemory();
    }
  }

  // ----------------------------------------------------------
  // Retrieval
  // ----------------------------------------------------------

  /**
   * Get all project memory as a single string (for system prompt injection).
   */
  getProjectMemoryText(): string {
    if (this.projectEntries.length === 0) return '';

    return this.projectEntries
      .map((e) => `<!-- From: ${e.source} -->\n${e.content}`)
      .join('\n\n');
  }

  /**
   * Get auto memory as a formatted string.
   */
  getAutoMemoryText(): string {
    if (this.autoEntries.length === 0) return '';

    return this.autoEntries
      .map((e) => `- ${e.content}`)
      .join('\n');
  }

  /**
   * Get all memory combined (for system prompt injection).
   */
  getAllMemoryText(): string {
    const parts: string[] = [];

    const project = this.getProjectMemoryText();
    if (project) {
      parts.push('## Project Rules & Context\n' + project);
    }

    const auto = this.getAutoMemoryText();
    if (auto) {
      parts.push('## Learned Preferences\n' + auto);
    }

    return parts.join('\n\n');
  }

  /**
   * Get all memory entries.
   */
  getAllEntries(): MemoryEntry[] {
    return [...this.projectEntries, ...this.autoEntries];
  }

  /**
   * Check if there is any memory loaded.
   */
  get hasMemory(): boolean {
    return this.projectEntries.length > 0 || this.autoEntries.length > 0;
  }

  // ----------------------------------------------------------
  // Auto-Extraction (harness-style learning)
  // ----------------------------------------------------------

  /**
   * Extract memorable facts from a conversation using the LLM.
   * Called after each conversation turn to auto-build memory.
   * Non-blocking: returns immediately, extraction happens in background.
   */
  async extractFromConversation(
    messages: Array<{ role: string; content: string }>,
    provider?: { chat: (msgs: any[], opts?: any) => AsyncGenerator<any> },
    model?: string,
  ): Promise<number> {
    if (!provider || !model || messages.length < 4) return 0;

    try {
      // Build a condensed conversation summary for extraction
      const convText = messages
        .filter(m => m.role === 'user' || m.role === 'assistant')
        .slice(-10) // Last 10 messages max
        .map(m => `${m.role}: ${m.content.slice(0, 500)}`)
        .join('\n\n');

      if (convText.length < 100) return 0;

      const extractMessages = [
        {
          role: 'system',
          content: `Extract memorable facts from this conversation. Focus on:
- User preferences (coding style, language, tools, workflow)
- Important decisions or conclusions
- Project context (architecture, tech stack, conventions)
- Corrections the user made to the assistant

Output ONLY new facts not already in the existing memory. One fact per line, prefixed with "- ". If nothing memorable, output "NOTHING".`,
        },
        {
          role: 'user',
          content: `Existing memory:\n${this.getAutoMemoryText() || '(empty)'}\n\nConversation:\n${convText}`,
        },
      ];

      let extraction = '';
      for await (const event of provider.chat(extractMessages, {
        model,
        maxTokens: 500,
        stream: true,
      })) {
        if (event.type === 'text_delta') extraction += event.text;
      }

      extraction = extraction.trim();
      if (!extraction || extraction === 'NOTHING') return 0;

      // Parse bullet points and save each as a memory
      const facts = extraction
        .split('\n')
        .map(l => l.replace(/^[-*]\s*/, '').trim())
        .filter(l => l.length > 5 && l.length < 300);

      let saved = 0;
      for (const fact of facts.slice(0, 5)) { // Max 5 new memories per turn
        // Avoid duplicates
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

  /**
   * Get memories relevant to the current user message (simple keyword matching).
   * Future: use embeddings for semantic similarity.
   */
  getRelevantMemories(userMessage: string, limit: number = 5): MemoryEntry[] {
    const msg = userMessage.toLowerCase();
    const words = msg.split(/\s+/).filter(w => w.length > 3);

    return this.autoEntries
      .map(entry => {
        const content = entry.content.toLowerCase();
        let score = 0;
        for (const word of words) {
          if (content.includes(word)) score++;
        }
        return { entry, score };
      })
      .filter(x => x.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, limit)
      .map(x => x.entry);
  }

  // ----------------------------------------------------------
  // Private
  // ----------------------------------------------------------

  private async loadAutoMemory(): Promise<void> {
    if (!this.storage) return;

    const entries = await this.storage.get<MemoryEntry[]>(AUTO_MEMORY_INDEX);
    if (entries && Array.isArray(entries)) {
      this.autoEntries = entries;
    }
  }

  private async persistAutoMemory(): Promise<void> {
    if (!this.storage) return;

    await this.storage.set(AUTO_MEMORY_INDEX, this.autoEntries);
  }
}
