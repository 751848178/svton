import type { IStorage, IFileSystem } from '@svton/agent-platform';
import type { AgentDefinition, AgentDefinitionSource } from './types';

const STORAGE_PREFIX = 'agent:agent_def:';

/**
 * Parse an agent definition from markdown with YAML-like frontmatter.
 * Format:
 * ---
 * name: my-agent
 * title: My Agent
 * description: Does things
 * model: deepseek-chat
 * tools: file_read, grep, glob
 * icon: bug
 * ---
 * System prompt body here...
 */
function parseAgentMarkdown(content: string, source: AgentDefinitionSource): AgentDefinition | null {
  const fmMatch = content.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);
  if (!fmMatch) return null;

  const frontmatter = fmMatch[1];
  const body = fmMatch[2].trim();
  const def: Partial<AgentDefinition> = { source };

  for (const line of frontmatter.split('\n')) {
    const m = line.match(/^(\w+):\s*(.*)$/);
    if (!m) continue;
    const [, key, value] = m;
    switch (key) {
      case 'name': def.name = value; break;
      case 'title': def.title = value; break;
      case 'description': def.description = value; break;
      case 'model': def.model = value; break;
      case 'tools': def.tools = value.split(',').map(s => s.trim()).filter(Boolean); break;
      case 'excludeTools': def.excludeTools = value.split(',').map(s => s.trim()).filter(Boolean); break;
      case 'icon': def.icon = value; break;
      case 'color': def.color = value; break;
      case 'permissions': def.permissions = value as any; break;
      case 'skills': def.skills = value.split(',').map(s => s.trim()).filter(Boolean); break;
    }
  }

  if (!def.name || !def.title) return null;
  def.description = def.description || '';
  def.systemPrompt = body || undefined;

  return def as AgentDefinition;
}

/**
 * Manages custom agent definitions.
 *
 * Definitions can come from three sources:
 * - **builtin**: Shipped defaults like "coder", "researcher", "planner"
 * - **user**: Created and saved by the user (persisted in storage)
 * - **project**: Defined per-project (persisted in storage)
 *
 * Built-in defaults are registered on construction and always available.
 * User/project definitions are loaded from storage via {@link loadFromStorage}.
 */
export class AgentDefinitionManager {
  private definitions = new Map<string, AgentDefinition>();

  constructor(private storage?: IStorage) {
    // Seed built-in defaults
    for (const def of this.getBuiltinDefaults()) {
      this.definitions.set(def.name, def);
    }
  }

  /**
   * Register a definition in memory.
   * If a definition with the same name exists, it is replaced.
   */
  register(def: AgentDefinition): void {
    this.definitions.set(def.name, def);
  }

  /**
   * List all registered definitions (built-in + user + project).
   */
  list(): AgentDefinition[] {
    return Array.from(this.definitions.values());
  }

  /**
   * Load agent definitions from `.svton/agents/*.md` files in a directory.
   * Also loads from `~/.svton/agents/*.md` for global user agents.
   * Project-level definitions override built-ins and global user definitions.
   */
  async loadFromDirectories(fs: IFileSystem, projectDir: string, homeDir?: string): Promise<number> {
    let count = 0;

    // Load global user agents from ~/.svton/agents/
    if (homeDir) {
      const globalDir = fs.join(homeDir, '.svton', 'agents');
      count += await this.loadFromDir(fs, globalDir, 'user');
    }

    // Load project-level agents from <project>/.svton/agents/
    const projectAgentsDir = fs.join(projectDir, '.svton', 'agents');
    count += await this.loadFromDir(fs, projectAgentsDir, 'project');

    return count;
  }

  private async loadFromDir(fs: IFileSystem, dir: string, source: AgentDefinitionSource): Promise<number> {
    let count = 0;
    let entries: string[];
    try {
      entries = (await fs.listDir(dir)).map(e => e.path);
    } catch {
      return 0; // Directory doesn't exist
    }

    for (const file of entries) {
      if (!file.endsWith('.md')) continue;
      try {
        const content = await fs.readFile(fs.join(dir, file));
        const def = parseAgentMarkdown(content, source);
        if (def) {
          this.definitions.set(def.name, def);
          count++;
        }
      } catch { /* skip unreadable files */ }
    }
    return count;
  }

  /**
   * Get a definition by name.
   */
  get(name: string): AgentDefinition | null {
    return this.definitions.get(name) ?? null;
  }

  /**
   * Load user and project definitions from persistent storage.
   * Built-in defaults are not overwritten unless a stored definition
   * with the same name exists (which overrides the builtin).
   */
  async loadFromStorage(): Promise<void> {
    if (!this.storage) return;

    const keys = await this.storage.list(STORAGE_PREFIX);
    for (const key of keys) {
      const def = await this.storage.get<AgentDefinition>(key);
      if (def) {
        this.definitions.set(def.name, def);
      }
    }
  }

  /**
   * Persist a definition to storage and register it in memory.
   */
  async save(def: AgentDefinition): Promise<void> {
    this.definitions.set(def.name, def);
    if (this.storage) {
      await this.storage.set(STORAGE_PREFIX + def.name, def);
    }
  }

  /**
   * Delete a definition from storage and memory.
   * Built-in defaults cannot be deleted from memory (they remain registered),
   * but will be removed from storage if present.
   */
  async delete(name: string): Promise<void> {
    this.definitions.delete(name);
    if (this.storage) {
      await this.storage.delete(STORAGE_PREFIX + name);
    }
  }

  /**
   * Built-in default agent definitions.
   */
  getBuiltinDefaults(): AgentDefinition[] {
    return [
      {
        name: 'coder',
        title: 'Coder',
        description:
          'General-purpose coding agent. Can read, write, and edit files, run shell commands, and search code.',
        systemPrompt:
          'You are an expert software engineer. Write clean, idiomatic code. Prefer minimal, surgical changes. Always verify your changes.',
        permissions: 'default',
        source: 'builtin',
        icon: 'code',
      },
      {
        name: 'researcher',
        title: 'Researcher',
        description:
          'Web research agent. Read-only file access with full web search and fetch capabilities. Cannot modify files.',
        tools: [
          'file_read',
          'grep',
          'glob',
          'web_search',
          'web_fetch',
        ],
        permissions: 'read_only',
        systemPrompt:
          'You are a thorough research assistant. Gather information from the web and local files. Summarize findings clearly. Do not attempt to modify files.',
        source: 'builtin',
        icon: 'search',
      },
      {
        name: 'planner',
        title: 'Planner',
        description:
          'Planning agent in read-only mode. Creates structured plans without modifying files.',
        permissions: 'plan',
        systemPrompt:
          'You are a planning specialist. Analyze the task, break it into concrete steps, and produce a structured plan. Do not modify files.',
        source: 'builtin',
        icon: 'clipboard-list',
      },
    ];
  }
}
