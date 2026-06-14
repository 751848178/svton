import type { IPlatform } from '@svton/agent-platform';
import type { ChatMessage, TokenUsage } from '../provider/types';
import type { AgentConfig, IRuntime } from '../agent/types';
import type { SubagentConfig, SubagentResult } from './types';
import { ToolRegistry } from '../tool/registry';

let subagentCounter = 0;

/**
 * Manages subagents - isolated Agent instances that handle delegated tasks.
 *
 * Key principles:
 * - Each subagent has its own context window (isolated from parent)
 * - Only a summary returns to the parent (not full conversation)
 * - Subagents can have restricted tool sets
 * - Subagents can run in parallel
 */
export class SubagentManager {
  private readonly parentConfig: AgentConfig;
  private readonly parentRuntime: IRuntime;
  private readonly platform: IPlatform;
  private readonly toolRegistry: ToolRegistry;

  constructor(
    parentConfig: AgentConfig,
    parentRuntime: IRuntime,
    platform: IPlatform,
    toolRegistry: ToolRegistry,
  ) {
    this.parentConfig = parentConfig;
    this.parentRuntime = parentRuntime;
    this.platform = platform;
    this.toolRegistry = toolRegistry;
  }

  /**
   * Spawn a single subagent to handle a task.
   */
  async spawn(config: SubagentConfig): Promise<SubagentResult> {
    const agentId = `subagent_${++subagentCounter}_${Date.now()}`;

    try {
      const subRegistry = this.buildToolRegistry(config);
      const subConfig = this.buildConfig(config, subRegistry);

      const runtime = this.createRuntime(subConfig, config);
      const { messages, usage } = await this.runSubagent(runtime, config.task);

      const summary = await this.summarize(messages);

      return {
        agentId,
        summary,
        messages,
        usage,
        success: true,
      };
    } catch (error) {
      return {
        agentId,
        summary: `Subagent failed: ${error instanceof Error ? error.message : String(error)}`,
        messages: [],
        usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * Spawn multiple subagents in parallel.
   */
  async spawnParallel(configs: SubagentConfig[]): Promise<SubagentResult[]> {
    return Promise.all(configs.map((config) => this.spawn(config)));
  }

  /**
   * Spawn subagents for each row of a CSV, filling the task template
   * with column values via {{column_name}} placeholders.
   *
   * Rows are processed with limited concurrency (default 4 at a time).
   */
  async spawnOnCsv(opts: {
    csvContent: string;
    taskTemplate: string; // {{column_name}} placeholders
    concurrency?: number; // default 4
    onRowStart?: (rowIndex: number, row: Record<string, string>) => void;
    onRowComplete?: (
      rowIndex: number,
      row: Record<string, string>,
      result: SubagentResult,
    ) => void;
  }): Promise<{
    results: Array<{ row: Record<string, string>; result: SubagentResult }>;
  }> {
    const { csvContent, taskTemplate, onRowStart, onRowComplete } = opts;
    const concurrency = Math.max(1, opts.concurrency ?? 4);

    const { headers, rows } = this.parseCsv(csvContent);

    if (headers.length === 0 || rows.length === 0) {
      return { results: [] };
    }

    // Build task per row by substituting placeholders
    const tasks = rows.map((row) => {
      const task = this.fillTemplate(taskTemplate, row);
      return { row, task };
    });

    const results: Array<{ row: Record<string, string>; result: SubagentResult }> = [];

    // Process in concurrency-limited chunks
    for (let i = 0; i < tasks.length; i += concurrency) {
      const chunk = tasks.slice(i, i + concurrency);
      const chunkResults = await Promise.all(
        chunk.map(async (item, offsetInChunk) => {
          const rowIndex = i + offsetInChunk;
          onRowStart?.(rowIndex, item.row);
          const result = await this.spawn({ task: item.task });
          onRowComplete?.(rowIndex, item.row, result);
          return { row: item.row, result };
        }),
      );
      results.push(...chunkResults);
    }

    return { results };
  }

  // ----------------------------------------------------------
  // CSV helpers
  // ----------------------------------------------------------

  /**
   * Simple split-based CSV parser with basic quote handling.
   * Splits by newlines, then each line by comma. Quoted fields
   * (surrounded by double quotes) may contain commas and are
   * handled by collapsing multi-line quoted values.
   */
  private parseCsv(content: string): {
    headers: string[];
    rows: Record<string, string>[];
  } {
    if (!content || !content.trim()) {
      return { headers: [], rows: [] };
    }

    // Normalize line endings
    const normalized = content.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

    // Split into records, respecting quoted newlines
    const records: string[][] = [];
    let currentRow: string[] = [];
    let currentField = '';
    let inQuotes = false;

    for (let i = 0; i < normalized.length; i++) {
      const char = normalized[i];

      if (inQuotes) {
        if (char === '"') {
          // Check for escaped quote
          if (normalized[i + 1] === '"') {
            currentField += '"';
            i++; // skip next quote
          } else {
            inQuotes = false;
          }
        } else {
          currentField += char;
        }
      } else {
        if (char === '"') {
          inQuotes = true;
        } else if (char === ',') {
          currentRow.push(currentField);
          currentField = '';
        } else if (char === '\n') {
          currentRow.push(currentField);
          records.push(currentRow);
          currentRow = [];
          currentField = '';
        } else {
          currentField += char;
        }
      }
    }

    // Push the last field/row if any content remains
    if (currentField.length > 0 || currentRow.length > 0) {
      currentRow.push(currentField);
      records.push(currentRow);
    }

    // Drop trailing empty record (e.g. from final newline)
    const filtered = records.filter(
      (r) => !(r.length === 1 && r[0] === ''),
    );
    if (filtered.length === 0) {
      return { headers: [], rows: [] };
    }

    const headers = filtered[0].map((h) => h.trim());

    const rows: Record<string, string>[] = [];
    for (let r = 1; r < filtered.length; r++) {
      const record = filtered[r];
      const row: Record<string, string> = {};
      for (let c = 0; c < headers.length; c++) {
        row[headers[c]] = record[c] ?? '';
      }
      rows.push(row);
    }

    return { headers, rows };
  }

  /**
   * Replace {{column_name}} placeholders with row values.
   * Missing columns are replaced with empty strings.
   */
  private fillTemplate(template: string, row: Record<string, string>): string {
    return template.replace(/\{\{\s*([\w.-]+)\s*\}\}/g, (match, key: string) => {
      const value = row[key];
      return value !== undefined ? value : '';
    });
  }

  // ----------------------------------------------------------
  // Private
  // ----------------------------------------------------------

  private buildToolRegistry(config: SubagentConfig): ToolRegistry {
    const registry = new ToolRegistry();

    // Copy tools from parent, applying allowlist/denylist
    const allDefs = this.toolRegistry.listDefinitions();

    for (const def of allDefs) {
      // Check denylist
      if (config.excludeTools?.includes(def.name)) continue;

      // Check allowlist (if specified, only include listed tools)
      if (config.tools && !config.tools.includes(def.name)) continue;

      const entry = this.toolRegistry.get(def.name);
      if (entry) {
        registry.register(entry.definition, entry.executor);
      }
    }

    return registry;
  }

  private buildConfig(config: SubagentConfig, registry: ToolRegistry): AgentConfig {
    // Propagate parent capabilities, excluding subagentManager to prevent infinite nesting
    const subCapabilities = this.parentConfig.capabilities
      ? { ...this.parentConfig.capabilities, subagentManager: undefined }
      : undefined;

    return {
      provider: this.parentConfig.provider,
      model: config.model || this.parentConfig.model,
      toolRegistry: registry,
      systemPrompt: this.buildSubagentPrompt(config),
      maxIterations: config.maxIterations || 20,
      workingDir: this.parentConfig.workingDir,
      contextConfig: this.parentConfig.contextConfig,
      capabilities: subCapabilities,
    };
  }

  private buildSubagentPrompt(config: SubagentConfig): string {
    const role = config.roleDescription || 'a specialized AI assistant';

    return `You are ${role}, working as a subagent.

## Your Task
${config.task}

## Guidelines
- Focus only on the assigned task
- Be concise and efficient
- When done, provide a clear summary of what you accomplished
- If you cannot complete the task, explain why`;
  }

  private createRuntime(config: AgentConfig, _subConfig: SubagentConfig): IRuntime {
    // Import dynamically to avoid circular dependency at module level
    // but use proper async-compatible import pattern
    const { AgentRuntime } = require('../agent/runtime') as typeof import('../agent/runtime');
    return AgentRuntime.create(config, this.platform);
  }

  private async runSubagent(
    runtime: IRuntime,
    task: string,
  ): Promise<{ messages: ChatMessage[]; usage: TokenUsage }> {
    const messages: ChatMessage[] = [];
    let finalUsage: TokenUsage = { promptTokens: 0, completionTokens: 0, totalTokens: 0 };

    const timeoutMs = 120000; // 2 minutes default
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
      let assistantText = '';

      for await (const event of runtime.run(task, { signal: controller.signal })) {
        switch (event.type) {
          case 'text_delta':
            assistantText += event.text;
            break;
          case 'done':
            finalUsage = event.usage;
            break;
        }
      }

      if (assistantText) {
        messages.push({ role: 'assistant', content: assistantText });
      }
    } finally {
      clearTimeout(timer);
    }

    // Also get the full conversation from the runtime
    const fullMessages = runtime.getMessages();

    return {
      messages: fullMessages.length > 0 ? fullMessages : messages,
      usage: finalUsage,
    };
  }

  /**
   * Generate a concise summary of the subagent's work.
   * Uses LLM for summarization when provider is available,
   * falls back to extracting the last assistant message.
   */
  private async summarize(messages: ChatMessage[]): Promise<string> {
    const assistantText = this.extractLastAssistantText(messages);
    if (!assistantText) return 'Subagent completed the task.';

    // Try LLM summarization
    try {
      const summary = await this.summarizeWithLLM(assistantText);
      if (summary) return summary;
    } catch {
      // Fall through to simple extraction
    }

    // Fallback: truncate last assistant message
    if (assistantText.length > 2000) {
      return assistantText.slice(0, 2000) + '...';
    }
    return assistantText;
  }

  private extractLastAssistantText(messages: ChatMessage[]): string {
    for (let i = messages.length - 1; i >= 0; i--) {
      const msg = messages[i];
      if (msg.role !== 'assistant') continue;
      if (typeof msg.content === 'string' && msg.content.trim()) {
        return msg.content.trim();
      }
      if (Array.isArray(msg.content)) {
        const textParts = msg.content
          .filter((b): b is { type: 'text'; text: string } => b.type === 'text')
          .map((b) => b.text);
        if (textParts.length > 0) return textParts.join('\n').trim();
      }
    }
    return '';
  }

  private async summarizeWithLLM(text: string): Promise<string | null> {
    const provider = this.parentConfig.provider;
    const model = this.parentConfig.model;

    const messages: ChatMessage[] = [
      {
        role: 'user',
        content: `Summarize the following subagent output in 3-5 concise sentences. Focus on what was accomplished and any key findings:\n\n${text.slice(0, 8000)}`,
      },
    ];

    const options = {
      model,
      stream: false,
    };

    let result = '';
    for await (const event of provider.chat(messages, options as any)) {
      if (event.type === 'text_delta') {
        result += event.text;
      }
    }

    return result.trim() || null;
  }
}
