import { describe, expect, it, vi } from 'vitest';
import { CsvFanoutExecutor } from '../src/tool/builtins/csv_fanout';
import type { ToolCall, ToolContext } from '../src/tool/types';
import { createMockPlatform } from './helpers';

function makeCall(args: Record<string, unknown>): ToolCall {
  return { id: 'csv-fanout-result', name: 'csv_fanout', arguments: args };
}

function makeContext(): ToolContext {
  return {
    platform: createMockPlatform(),
    sessionId: 'session',
    workingDir: '/repo',
  };
}

describe('csv_fanout error formatting', () => {
  it('normalizes non-Error subagent manager failures', async () => {
    const manager = {
      spawnOnCsv: vi.fn(async () => {
        throw { code: 'fanout_down' };
      }),
    };

    const result = await new CsvFanoutExecutor(manager as any).execute(
      makeCall({
        csv_content: ' \nname\nAlice\t ',
        task_template: ' Find {{name}}\n',
        concurrency: 2,
      }),
      makeContext(),
    );

    expect(result.isError).toBe(true);
    expect(result.output).toContain('CSV fan-out error: Unknown error');
    expect(result.output).not.toContain('[object Object]');
    expect(result.output).not.toContain('Alice');
    expect(result.metadata).toMatchObject({
      csvLength: 10,
      taskTemplateLength: 13,
      concurrency: 2,
    });
    expect(manager.spawnOnCsv).toHaveBeenCalledWith({
      csvContent: 'name\nAlice',
      taskTemplate: 'Find {{name}}',
      concurrency: 2,
    });
  });
});
