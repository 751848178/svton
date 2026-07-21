/**
 * csv_fanout tool.
 *
 * Spawns subagents for each row of a CSV input, filling the task
 * template with {{column_name}} placeholders. Useful for batch
 * processing (e.g. per-row research, per-record transformations).
 */

import type { ToolDefinition, ToolAnnotations } from '../../provider/types';
import type { ToolCall, ToolResult, ToolContext, IToolExecutor } from '../types';
import type { SubagentManager } from '../../subagent/manager';
import {
  CSV_FANOUT_CONCURRENCY_ERROR,
  resolveCsvFanoutConcurrency,
} from '../../subagent/csv-fanout.utils';
import { formatUnknownErrorMessage } from './error-message.utils';

export const csvFanoutDef: ToolDefinition = {
  name: 'csv_fanout',
  description:
    'Spawn a subagent for each row of a CSV input. ' +
    'Each row fills {{column_name}} placeholders in the task template. ' +
    'Rows are processed in parallel with limited concurrency.',
  parameters: {
    type: 'object',
    properties: {
      csv_content: {
        type: 'string',
        description: 'The CSV content including a header row.',
      },
      task_template: {
        type: 'string',
        description:
          'Task template with {{column_name}} placeholders that will be ' +
          'filled per CSV row. Example: "Look up {{company}} and summarize."',
      },
      concurrency: {
        type: 'number',
        description: 'Maximum number of parallel subagents. Default: 4.',
      },
    },
    required: ['csv_content', 'task_template'],
  },
  annotations: {
    readOnlyHint: false,
    destructiveHint: false,
    idempotentHint: false,
    openWorldHint: true,
  } satisfies ToolAnnotations,
};

export class CsvFanoutExecutor implements IToolExecutor {
  constructor(private readonly subagentManager: SubagentManager) {}

  async execute(call: ToolCall, _ctx: ToolContext): Promise<ToolResult> {
    const { csv_content, task_template, concurrency } = call.arguments as {
      csv_content?: string;
      task_template?: string;
      concurrency?: number;
    };

    if (typeof csv_content !== 'string' || csv_content.trim().length === 0) {
      return {
        callId: call.id,
        output: 'Error: "csv_content" is required and must be a string.',
        isError: true,
      };
    }
    const resolvedCsvContent = csv_content.trim();
    if (typeof task_template !== 'string' || task_template.trim().length === 0) {
      return {
        callId: call.id,
        output: 'Error: "task_template" is required and must be a string.',
        isError: true,
      };
    }
    const resolvedTaskTemplate = task_template.trim();
    if (concurrency !== undefined) {
      try {
        resolveCsvFanoutConcurrency(concurrency);
      } catch {
        return {
          callId: call.id,
          output: CSV_FANOUT_CONCURRENCY_ERROR,
          isError: true,
        };
      }
    }

    try {
      const { results } = await this.subagentManager.spawnOnCsv({
        csvContent: resolvedCsvContent,
        taskTemplate: resolvedTaskTemplate,
        concurrency,
      });

      const summary = results
        .map((r, i) => {
          const status = r.result.success ? 'OK' : 'FAILED';
          const err = r.result.error ? ` — ${r.result.error}` : '';
          return `Row ${i}: [${status}] ${r.result.summary}${err}`;
        })
        .join('\n');

      const successCount = results.filter((r) => r.result.success).length;
      const failCount = results.length - successCount;

      return {
        callId: call.id,
        output:
          `CSV fan-out completed: ${successCount} succeeded, ${failCount} failed out of ${results.length} rows.\n\n${summary}`,
        metadata: {
          totalRows: results.length,
          successCount,
          failCount,
          results: results.map((r) => ({
            summary: r.result.summary,
            success: r.result.success,
            error: r.result.error,
          })),
        },
      };
    } catch (error) {
      return {
        callId: call.id,
        output: `CSV fan-out error: ${formatUnknownErrorMessage(error)}`,
        isError: true,
        metadata: {
          csvLength: resolvedCsvContent.length,
          taskTemplateLength: resolvedTaskTemplate.length,
          concurrency: concurrency ?? null,
        },
      };
    }
  }
}
