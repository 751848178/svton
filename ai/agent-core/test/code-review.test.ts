import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  codeReviewSkill,
  gitDiffDef,
  GitDiffExecutor,
  gitLogRangeDef,
} from '@svton/agent-core';
import type { ToolCall, ToolContext } from '@svton/agent-core';
import type { IPlatform, IProcess } from '@svton/agent-platform';

// ==============================================================
// Mock Helpers
// ==============================================================

function createMockPlatform(withProcess: boolean = true): IPlatform {
  const execMock = vi.fn(async (): Promise<any> => ({
    stdout: 'diff --git a/file b/file\n+changed line',
    stderr: '',
    exitCode: 0,
    timedOut: false,
  }));

  return {
    type: 'tauri',
    capabilities: {
      filesystem: true,
      process: withProcess,
      watch: false,
      mcpStdio: false,
      clipboard: false,
      notification: false,
    },
    fs: {} as any,
    process: withProcess
      ? ({ exec: execMock } as unknown as IProcess)
      : ({} as any),
    storage: {} as any,
    search: {} as any,
  };
}

function createContext(platform: IPlatform): ToolContext {
  return {
    platform,
    sessionId: 'test-session',
    workingDir: '/repo',
  };
}

// ==============================================================
// Tests
// ==============================================================

describe('F11 — Code Review', () => {
  // ----------------------------------------------------------
  // codeReviewSkill
  // ----------------------------------------------------------
  describe('codeReviewSkill definition', () => {
    it('has the correct name', () => {
      expect(codeReviewSkill.name).toBe('code-review');
    });

    it('has a non-empty description', () => {
      expect(codeReviewSkill.description.length).toBeGreaterThan(0);
    });

    it('includes /review in triggerSignals', () => {
      expect(codeReviewSkill.triggerSignals).toBeDefined();
      expect(codeReviewSkill.triggerSignals!).toContain('/review');
    });

    it('includes "code review" in triggerSignals', () => {
      expect(codeReviewSkill.triggerSignals!).toContain('code review');
    });

    it('has git_diff in requiredTools', () => {
      expect(codeReviewSkill.requiredTools).toBeDefined();
      expect(codeReviewSkill.requiredTools!).toContain('git_diff');
    });

    it('has a trigger of type implicit with /review pattern', () => {
      expect(codeReviewSkill.trigger).toBeDefined();
      expect(codeReviewSkill.trigger!.type).toBe('implicit');
      expect(codeReviewSkill.trigger!.patterns).toContain('/review');
    });

    it('includes instructions content', () => {
      expect(codeReviewSkill.instructions).toBeDefined();
      expect(codeReviewSkill.instructions.length).toBeGreaterThan(100);
    });

    it('has allowedTools that includes file_read, grep, glob', () => {
      expect(codeReviewSkill.allowedTools).toBeDefined();
      expect(codeReviewSkill.allowedTools!).toContain('file_read');
      expect(codeReviewSkill.allowedTools!).toContain('grep');
      expect(codeReviewSkill.allowedTools!).toContain('glob');
    });

    // Regression: web_search / web_fetch / bash must be in the whitelist.
    // Before this fix the hard whitelist only had git_diff/git_log_range/
    // file_read/grep/glob, so reviewing with external lookups or running
    // verification commands was blocked with "not in the allowed list".
    it('allows web_search, web_fetch, and bash for verification and lookups', () => {
      expect(codeReviewSkill.allowedTools).toBeDefined();
      expect(codeReviewSkill.allowedTools!).toContain('web_search');
      expect(codeReviewSkill.allowedTools!).toContain('web_fetch');
      expect(codeReviewSkill.allowedTools!).toContain('bash');
    });

    it('excludes destructive write tools from allowedTools', () => {
      expect(codeReviewSkill.allowedTools).toBeDefined();
      expect(codeReviewSkill.allowedTools!).not.toContain('file_edit');
      expect(codeReviewSkill.allowedTools!).not.toContain('file_write');
    });

    it('has whenToUse with relevant entries', () => {
      expect(codeReviewSkill.whenToUse).toBeDefined();
      expect(codeReviewSkill.whenToUse!.length).toBeGreaterThan(0);
    });

    it('has avoidWhen entries', () => {
      expect(codeReviewSkill.avoidWhen).toBeDefined();
      expect(codeReviewSkill.avoidWhen!.length).toBeGreaterThan(0);
    });
  });

  // ----------------------------------------------------------
  // gitDiffDef
  // ----------------------------------------------------------
  describe('gitDiffDef', () => {
    it('has the name git_diff', () => {
      expect(gitDiffDef.name).toBe('git_diff');
    });

    it('has base parameter of type string', () => {
      const baseProp = gitDiffDef.parameters.properties.base as any;
      expect(baseProp).toBeDefined();
      expect(baseProp.type).toBe('string');
    });

    it('has head parameter of type string', () => {
      const headProp = gitDiffDef.parameters.properties.head as any;
      expect(headProp).toBeDefined();
      expect(headProp.type).toBe('string');
    });

    it('has paths parameter as an array', () => {
      const pathsProp = gitDiffDef.parameters.properties.paths as any;
      expect(pathsProp).toBeDefined();
      expect(pathsProp.type).toBe('array');
    });

    it('has stat_only parameter of type boolean', () => {
      const statProp = gitDiffDef.parameters.properties.stat_only as any;
      expect(statProp).toBeDefined();
      expect(statProp.type).toBe('boolean');
    });

    it('has no required parameters', () => {
      expect(gitDiffDef.parameters.required).toEqual([]);
    });

    it('is marked as readOnlyHint', () => {
      expect(gitDiffDef.annotations?.readOnlyHint).toBe(true);
    });
  });

  // ----------------------------------------------------------
  // gitLogRangeDef
  // ----------------------------------------------------------
  describe('gitLogRangeDef', () => {
    it('has the name git_log_range', () => {
      expect(gitLogRangeDef.name).toBe('git_log_range');
    });

    it('has base, head, and limit parameters', () => {
      const props = gitLogRangeDef.parameters.properties as any;
      expect(props.base).toBeDefined();
      expect(props.head).toBeDefined();
      expect(props.limit).toBeDefined();
    });
  });

  // ----------------------------------------------------------
  // GitDiffExecutor
  // ----------------------------------------------------------
  describe('GitDiffExecutor', () => {
    it('handles missing process capability gracefully', async () => {
      const platform = createMockPlatform(false);
      const executor = new GitDiffExecutor();
      const call: ToolCall = {
        id: '1',
        name: 'git_diff',
        arguments: { base: 'main' },
      };

      const result = await executor.execute(call, createContext(platform));

      expect(result.isError).toBe(true);
      expect(result.output).toContain('not available');
    });

    it('executes git diff and returns output on success', async () => {
      const platform = createMockPlatform(true);
      const executor = new GitDiffExecutor();
      const call: ToolCall = {
        id: '2',
        name: 'git_diff',
        arguments: { base: 'main', head: 'feature' },
      };

      const result = await executor.execute(call, createContext(platform));

      expect(result.isError).toBeFalsy();
      expect(result.output).toContain('diff --git');
    });

    it('passes stat_only as --stat flag', async () => {
      const execMock = vi.fn(async (): Promise<any> => ({
        stdout: 'file.ts | 5 +++--',
        stderr: '',
        exitCode: 0,
        timedOut: false,
      }));
      const platform: IPlatform = {
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
        process: { exec: execMock } as unknown as IProcess,
        storage: {} as any,
        search: {} as any,
      };

      const executor = new GitDiffExecutor();
      const call: ToolCall = {
        id: '3',
        name: 'git_diff',
        arguments: { stat_only: true },
      };

      await executor.execute(call, createContext(platform));

      expect(execMock).toHaveBeenCalled();
      const cmd = execMock.mock.calls[0][0];
      expect(cmd).toContain('--stat');
    });

    it('builds range argument as base...head when both provided', async () => {
      const execMock = vi.fn(async (): Promise<any> => ({
        stdout: 'diff output',
        stderr: '',
        exitCode: 0,
        timedOut: false,
      }));
      const platform: IPlatform = {
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
        process: { exec: execMock } as unknown as IProcess,
        storage: {} as any,
        search: {} as any,
      };

      const executor = new GitDiffExecutor();
      const call: ToolCall = {
        id: '4',
        name: 'git_diff',
        arguments: { base: 'develop', head: 'feature-x' },
      };

      await executor.execute(call, createContext(platform));

      const cmd = execMock.mock.calls[0][0];
      expect(cmd).toContain('develop...feature-x');
    });

    it('returns "(no changes detected)" when diff is empty', async () => {
      const execMock = vi.fn(async (): Promise<any> => ({
        stdout: '',
        stderr: '',
        exitCode: 0,
        timedOut: false,
      }));
      const platform: IPlatform = {
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
        process: { exec: execMock } as unknown as IProcess,
        storage: {} as any,
        search: {} as any,
      };

      const executor = new GitDiffExecutor();
      const call: ToolCall = {
        id: '5',
        name: 'git_diff',
        arguments: {},
      };

      const result = await executor.execute(call, createContext(platform));

      expect(result.output).toContain('(no changes detected)');
    });
  });
});
