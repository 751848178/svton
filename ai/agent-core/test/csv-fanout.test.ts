import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  SubagentManager,
  ToolRegistry,
  csvFanoutDef,
  CsvFanoutExecutor,
} from '@svton/agent-core';
import type {
  SubagentConfig,
  SubagentResult,
  ToolCall,
  ToolContext,
  IToolExecutor,
} from '@svton/agent-core';
import type { AgentConfig, AgentRuntime as AgentRuntimeType } from '@svton/agent-core';
import type { IPlatform } from '@svton/agent-platform';

// ==============================================================
// Mock Helpers
// ==============================================================

function createMockToolExecutor(): IToolExecutor {
  return {
    execute: async (call: ToolCall) => ({
      callId: call.id,
      output: 'ok',
    }),
  };
}

function createParentToolRegistry(): ToolRegistry {
  const registry = new ToolRegistry();
  for (const name of ['bash', 'file_read', 'file_write']) {
    registry.register(
      {
        name,
        description: `Tool: ${name}`,
        parameters: { type: 'object' as const, properties: {} },
      },
      createMockToolExecutor(),
    );
  }
  return registry;
}

function createMockPlatform(): IPlatform {
  return {
    type: 'tauri',
    capabilities: {
      filesystem: true,
      process: true,
      watch: false,
      mcpStdio: false,
      clipboard: false,
      notification: false,
    },
    fs: {} as any,
    process: {} as any,
    storage: {} as any,
    search: {} as any,
  };
}

function createMockRuntime() {
  return {
    run: vi.fn(async function* (): AsyncGenerator<any> {
      yield { type: 'text_delta', text: 'subagent result' };
      yield {
        type: 'done',
        stopReason: 'stop',
        usage: { promptTokens: 10, completionTokens: 5, totalTokens: 15 },
      };
    }),
    getMessages: vi.fn(() => []),
    abort: vi.fn(),
  };
}

// ==============================================================
// Tests
// ==============================================================

describe('F6 — CSV Fan-out', () => {
  // ----------------------------------------------------------
  // SubagentManager.spawnOnCsv — CSV parsing + template replacement
  // ----------------------------------------------------------
  describe('SubagentManager.spawnOnCsv()', () => {
    let subagentManager: SubagentManager;

    beforeEach(() => {
      const toolRegistry = createParentToolRegistry();
      const platform = createMockPlatform();
      const parentConfig: AgentConfig = {
        provider: {
          name: 'mock',
          models: [],
          chat: async function* () {
            yield { type: 'done', stopReason: 'stop' } as any;
          },
          countTokens: () => 1,
          supportsToolUse: () => true,
          supportsVision: () => false,
        },
        model: 'test-model',
        toolRegistry,
      };
      const mockRuntime = createMockRuntime();
      subagentManager = new SubagentManager(
        parentConfig,
        mockRuntime as any,
        platform,
        toolRegistry,
      );
    });

    it('parses a simple CSV with header and data rows', async () => {
      const csv = [
        'name,company,role',
        'Alice,Acme,Engineer',
        'Bob,Globex,Manager',
      ].join('\n');

      // Track spawned tasks
      const spawnedTasks: string[] = [];
      const origSpawn = subagentManager.spawn.bind(subagentManager);
      vi.spyOn(subagentManager, 'spawn').mockImplementation(
        async (config: SubagentConfig): Promise<SubagentResult> => {
          spawnedTasks.push(config.task);
          return {
            agentId: 'test-agent',
            summary: 'done',
            messages: [],
            usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
            success: true,
          };
        },
      );

      const { results } = await subagentManager.spawnOnCsv({
        csvContent: csv,
        taskTemplate: 'Research {{name}} at {{company}} as {{role}}',
      });

      expect(results).toHaveLength(2);
      expect(spawnedTasks[0]).toBe('Research Alice at Acme as Engineer');
      expect(spawnedTasks[1]).toBe('Research Bob at Globex as Manager');
    });

    it('handles empty CSV gracefully', async () => {
      const { results } = await subagentManager.spawnOnCsv({
        csvContent: '',
        taskTemplate: 'test',
      });

      expect(results).toEqual([]);
    });

    it('handles CSV with only headers (no data rows)', async () => {
      const { results } = await subagentManager.spawnOnCsv({
        csvContent: 'name,company',
        taskTemplate: 'test {{name}}',
      });

      expect(results).toEqual([]);
    });

    it('replaces missing column placeholders with empty string', async () => {
      vi.spyOn(subagentManager, 'spawn').mockImplementation(
        async (config: SubagentConfig): Promise<SubagentResult> => ({
          agentId: 'a',
          summary: config.task,
          messages: [],
          usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
          success: true,
        }),
      );

      const csv = 'name,company\nAlice,Acme';
      const { results } = await subagentManager.spawnOnCsv({
        csvContent: csv,
        taskTemplate: 'Name: {{name}}, Missing: {{nonexistent}}',
      });

      expect(results).toHaveLength(1);
      // The summary should contain the filled task
      expect(results[0].result.summary).toContain('Name: Alice');
      expect(results[0].result.summary).toContain('Missing: ');
    });

    it('supports quoted CSV fields containing commas', async () => {
      const spawned: string[] = [];
      vi.spyOn(subagentManager, 'spawn').mockImplementation(
        async (config: SubagentConfig): Promise<SubagentResult> => {
          spawned.push(config.task);
          return {
            agentId: 'a',
            summary: 'done',
            messages: [],
            usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
            success: true,
          };
        },
      );

      const csv = 'name,note\n"Smith, John","has a comma"';
      const { results } = await subagentManager.spawnOnCsv({
        csvContent: csv,
        taskTemplate: '{{name}} — {{note}}',
      });

      expect(results).toHaveLength(1);
      expect(spawned[0]).toBe('Smith, John — has a comma');
    });
  });

  // ----------------------------------------------------------
  // Concurrency limiting
  // ----------------------------------------------------------
  describe('concurrency limiting', () => {
    let subagentManager: SubagentManager;

    beforeEach(() => {
      const toolRegistry = createParentToolRegistry();
      const platform = createMockPlatform();
      const parentConfig: AgentConfig = {
        provider: {
          name: 'mock',
          models: [],
          chat: async function* () {
            yield { type: 'done', stopReason: 'stop' } as any;
          },
          countTokens: () => 1,
          supportsToolUse: () => true,
          supportsVision: () => false,
        },
        model: 'test-model',
        toolRegistry,
      };
      const mockRuntime = createMockRuntime();
      subagentManager = new SubagentManager(
        parentConfig,
        mockRuntime as any,
        platform,
        toolRegistry,
      );
    });

    it('processes rows with limited concurrency', async () => {
      let activeCount = 0;
      let maxActive = 0;

      vi.spyOn(subagentManager, 'spawn').mockImplementation(
        async (_config: SubagentConfig): Promise<SubagentResult> => {
          activeCount++;
          maxActive = Math.max(maxActive, activeCount);
          // Simulate async work
          await new Promise((r) => setTimeout(r, 10));
          activeCount--;
          return {
            agentId: 'a',
            summary: 'done',
            messages: [],
            usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
            success: true,
          };
        },
      );

      // 6 rows with concurrency=2 → max active should be 2
      const rows = Array.from({ length: 6 }, (_, i) => `row${i},val${i}`).join('\n');
      const csv = `col1,col2\n${rows}`;

      await subagentManager.spawnOnCsv({
        csvContent: csv,
        taskTemplate: '{{col1}}',
        concurrency: 2,
      });

      expect(maxActive).toBeLessThanOrEqual(2);
    });

    it('defaults to concurrency=4 when not specified', async () => {
      let activeCount = 0;
      let maxActive = 0;

      vi.spyOn(subagentManager, 'spawn').mockImplementation(
        async (): Promise<SubagentResult> => {
          activeCount++;
          maxActive = Math.max(maxActive, activeCount);
          await new Promise((r) => setTimeout(r, 10));
          activeCount--;
          return {
            agentId: 'a',
            summary: 'done',
            messages: [],
            usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
            success: true,
          };
        },
      );

      const rows = Array.from({ length: 8 }, (_, i) => `r${i},v${i}`).join('\n');
      const csv = `a,b\n${rows}`;

      await subagentManager.spawnOnCsv({
        csvContent: csv,
        taskTemplate: '{{a}}',
      });

      expect(maxActive).toBeLessThanOrEqual(4);
    });
  });

  // ----------------------------------------------------------
  // onRowStart / onRowComplete callbacks
  // ----------------------------------------------------------
  describe('callbacks', () => {
    let subagentManager: SubagentManager;

    beforeEach(() => {
      const toolRegistry = createParentToolRegistry();
      const platform = createMockPlatform();
      const parentConfig: AgentConfig = {
        provider: {
          name: 'mock',
          models: [],
          chat: async function* () {
            yield { type: 'done', stopReason: 'stop' } as any;
          },
          countTokens: () => 1,
          supportsToolUse: () => true,
          supportsVision: () => false,
        },
        model: 'test-model',
        toolRegistry,
      };
      const mockRuntime = createMockRuntime();
      subagentManager = new SubagentManager(
        parentConfig,
        mockRuntime as any,
        platform,
        toolRegistry,
      );
    });

    it('fires onRowStart and onRowComplete for each row', async () => {
      vi.spyOn(subagentManager, 'spawn').mockImplementation(
        async (): Promise<SubagentResult> => ({
          agentId: 'a',
          summary: 'ok',
          messages: [],
          usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
          success: true,
        }),
      );

      const csv = 'name\nAlice\nBob';
      const started: number[] = [];
      const completed: number[] = [];

      await subagentManager.spawnOnCsv({
        csvContent: csv,
        taskTemplate: 'hi {{name}}',
        onRowStart: (idx) => started.push(idx),
        onRowComplete: (idx) => completed.push(idx),
      });

      expect(started).toHaveLength(2);
      expect(completed).toHaveLength(2);
    });
  });

  // ----------------------------------------------------------
  // CsvFanoutExecutor
  // ----------------------------------------------------------
  describe('CsvFanoutExecutor', () => {
    it('returns an error when csv_content is missing', async () => {
      const mockManager = {
        spawnOnCsv: vi.fn(),
      } as unknown as SubagentManager;
      const executor = new CsvFanoutExecutor(mockManager);

      const call: ToolCall = {
        id: '1',
        name: 'csv_fanout',
        arguments: { task_template: 'test' },
      };
      const ctx: ToolContext = {
        platform: createMockPlatform(),
        sessionId: '',
        workingDir: '/tmp',
      };

      const result = await executor.execute(call, ctx);
      expect(result.isError).toBe(true);
      expect(result.output).toContain('csv_content');
    });

    it('returns an error when task_template is missing', async () => {
      const mockManager = {
        spawnOnCsv: vi.fn(),
      } as unknown as SubagentManager;
      const executor = new CsvFanoutExecutor(mockManager);

      const call: ToolCall = {
        id: '2',
        name: 'csv_fanout',
        arguments: { csv_content: 'a,b\n1,2' },
      };
      const ctx: ToolContext = {
        platform: createMockPlatform(),
        sessionId: '',
        workingDir: '/tmp',
      };

      const result = await executor.execute(call, ctx);
      expect(result.isError).toBe(true);
      expect(result.output).toContain('task_template');
    });

    it('returns an error when csv_content is blank before spawning', async () => {
      const mockManager = {
        spawnOnCsv: vi.fn(),
      } as unknown as SubagentManager;
      const executor = new CsvFanoutExecutor(mockManager);

      const result = await executor.execute(
        {
          id: 'blank-csv',
          name: 'csv_fanout',
          arguments: { csv_content: ' \n\t ', task_template: 'Find {{name}}' },
        },
        {
          platform: createMockPlatform(),
          sessionId: '',
          workingDir: '/tmp',
        },
      );

      expect(result.isError).toBe(true);
      expect(result.output).toContain('csv_content');
      expect(mockManager.spawnOnCsv).not.toHaveBeenCalled();
    });

    it('returns an error when task_template is blank before spawning', async () => {
      const mockManager = {
        spawnOnCsv: vi.fn(),
      } as unknown as SubagentManager;
      const executor = new CsvFanoutExecutor(mockManager);

      const result = await executor.execute(
        {
          id: 'blank-template',
          name: 'csv_fanout',
          arguments: { csv_content: 'name\nAlice', task_template: ' \n\t ' },
        },
        {
          platform: createMockPlatform(),
          sessionId: '',
          workingDir: '/tmp',
        },
      );

      expect(result.isError).toBe(true);
      expect(result.output).toContain('task_template');
      expect(mockManager.spawnOnCsv).not.toHaveBeenCalled();
    });

    it.each([
      ['non-number', '2'],
      ['non-finite', Number.NaN],
      ['non-positive', 0],
      ['fractional', 1.5],
    ])('returns an error when concurrency is %s', async (_label, concurrency) => {
      const mockManager = {
        spawnOnCsv: vi.fn(),
      } as unknown as SubagentManager;
      const executor = new CsvFanoutExecutor(mockManager);

      const call: ToolCall = {
        id: 'invalid-concurrency',
        name: 'csv_fanout',
        arguments: {
          csv_content: 'name\nAlice',
          task_template: 'Find {{name}}',
          concurrency,
        },
      };
      const ctx: ToolContext = {
        platform: createMockPlatform(),
        sessionId: '',
        workingDir: '/tmp',
      };

      const result = await executor.execute(call, ctx);

      expect(result.isError).toBe(true);
      expect(result.output).toContain('"concurrency" must be a positive integer');
      expect(mockManager.spawnOnCsv).not.toHaveBeenCalled();
    });

    it('uses trimmed csv_content and task_template before spawning', async () => {
      const mockManager = {
        spawnOnCsv: vi.fn(async () => ({ results: [] })),
      } as unknown as SubagentManager;
      const executor = new CsvFanoutExecutor(mockManager);

      const result = await executor.execute(
        {
          id: 'trimmed-inputs',
          name: 'csv_fanout',
          arguments: {
            csv_content: ' \nname\nAlice\t ',
            task_template: ' Find {{name}}\n',
          },
        },
        {
          platform: createMockPlatform(),
          sessionId: '',
          workingDir: '/tmp',
        },
      );

      expect(result.isError).toBeFalsy();
      expect(mockManager.spawnOnCsv).toHaveBeenCalledWith({
        csvContent: 'name\nAlice',
        taskTemplate: 'Find {{name}}',
        concurrency: undefined,
      });
    });

    it('delegates to spawnOnCsv and returns a summary', async () => {
      const mockManager = {
        spawnOnCsv: vi.fn(async () => ({
          results: [
            {
              row: { name: 'Alice' },
              result: {
                agentId: 'a1',
                summary: 'Found Alice',
                messages: [],
                usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
                success: true,
              },
            },
          ],
        })),
      } as unknown as SubagentManager;

      const executor = new CsvFanoutExecutor(mockManager);
      const call: ToolCall = {
        id: '3',
        name: 'csv_fanout',
        arguments: {
          csv_content: 'name\nAlice',
          task_template: 'Find {{name}}',
        },
      };
      const ctx: ToolContext = {
        platform: createMockPlatform(),
        sessionId: '',
        workingDir: '/tmp',
      };

      const result = await executor.execute(call, ctx);

      expect(result.isError).toBeFalsy();
      expect(result.output).toContain('1 succeeded');
      expect(result.output).toContain('Found Alice');
      expect(mockManager.spawnOnCsv).toHaveBeenCalled();
    });

    it('preserves non-sensitive request metadata when spawnOnCsv throws', async () => {
      const mockManager = {
        spawnOnCsv: vi.fn(async () => {
          throw new Error('fanout unavailable');
        }),
      } as unknown as SubagentManager;
      const executor = new CsvFanoutExecutor(mockManager);

      const result = await executor.execute(
        {
          id: 'spawn-failure',
          name: 'csv_fanout',
          arguments: {
            csv_content: ' \nname\nAlice\t ',
            task_template: ' Find {{name}}\n',
            concurrency: 2,
          },
        },
        {
          platform: createMockPlatform(),
          sessionId: '',
          workingDir: '/tmp',
        },
      );

      expect(result.isError).toBe(true);
      expect(result.output).toContain('fanout unavailable');
      expect(result.output).not.toContain('Alice');
      expect(result.metadata).toMatchObject({
        csvLength: 10,
        taskTemplateLength: 13,
        concurrency: 2,
      });
    });

    it('csvFanoutDef has correct name and required fields', () => {
      expect(csvFanoutDef.name).toBe('csv_fanout');
      expect(csvFanoutDef.parameters.required).toContain('csv_content');
      expect(csvFanoutDef.parameters.required).toContain('task_template');
    });
  });
});
