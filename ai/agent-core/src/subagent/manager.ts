import type { IPlatform } from '@svton/agent-platform';
import type { AgentConfig, IRuntime } from '../agent/types';
import type { SubagentConfig, SubagentResult } from './types';
import { ToolRegistry } from '../tool/registry';
import {
  fillCsvFanoutTemplate,
  parseCsvFanoutContent,
  resolveCsvFanoutConcurrency,
} from './csv-fanout.utils';
import {
  buildSubagentConfig,
  buildSubagentToolRegistry,
} from './subagent-config.utils';
import {
  runSubagentRuntime,
  seedSubagentRuntimeContext,
  summarizeSubagentMessages,
} from './subagent-runtime.utils';
import { formatUnknownErrorMessage } from '../utils/error-message.utils';

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
      const normalizedConfig = { ...config, task: normalizeSubagentTask(config.task) };
      const subRegistry = buildSubagentToolRegistry(this.toolRegistry, normalizedConfig);
      const subConfig = buildSubagentConfig(this.parentConfig, normalizedConfig, subRegistry);

      const runtime = this.createRuntime(subConfig, normalizedConfig);
      seedSubagentRuntimeContext(runtime, this.parentRuntime, normalizedConfig);
      const { messages, usage } = await runSubagentRuntime(
        runtime,
        normalizedConfig.task,
        normalizedConfig.timeout,
      );

      const summary = await summarizeSubagentMessages(this.parentConfig, messages);

      return {
        agentId,
        summary,
        messages,
        usage,
        success: true,
      };
    } catch (error) {
      const errorMessage = formatUnknownErrorMessage(error);
      return {
        agentId,
        summary: `Subagent failed: ${errorMessage}`,
        messages: [],
        usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
        success: false,
        error: errorMessage,
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
    const concurrency = resolveCsvFanoutConcurrency(opts.concurrency);

    const { headers, rows } = parseCsvFanoutContent(csvContent);

    if (headers.length === 0 || rows.length === 0) {
      return { results: [] };
    }

    // Build task per row by substituting placeholders
    const tasks = rows.map((row) => {
      const task = fillCsvFanoutTemplate(taskTemplate, row);
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

  private createRuntime(config: AgentConfig, _subConfig: SubagentConfig): IRuntime {
    // Import dynamically to avoid circular dependency at module level
    // but use proper async-compatible import pattern
    const { AgentRuntime } = require('../agent/runtime') as typeof import('../agent/runtime');
    return AgentRuntime.create(config, this.platform);
  }
}

function normalizeSubagentTask(task: unknown): string {
  if (typeof task !== 'string' || task.trim().length === 0) {
    throw new Error('Error: "task" is required and must be a string.');
  }
  return task.trim();
}
