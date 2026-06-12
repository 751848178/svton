import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Direct imports from source modules
import { BashExecutor } from '../src/tool/builtins/shell';
import { FileReadExecutor, FileWriteExecutor, FileEditExecutor } from '../src/tool/builtins/file';
import { GrepExecutor, GlobExecutor } from '../src/tool/builtins/search';
import { WebSearchExecutor, WebFetchExecutor } from '../src/tool/builtins/web';
import { MemorySaveExecutor, MemoryRecallExecutor } from '../src/tool/builtins/memory';
import { PlanCreateExecutor, PlanGetStatusExecutor, PlanUpdateStepExecutor } from '../src/tool/builtins/planning';

import type { ToolCall, ToolResult, ToolContext } from '../src/tool/types';
import type { IPlatform, IFileSystem, IProcess, ISearch, ExecResult } from '@svton/agent-platform';
import type { Plan, PlanStep } from '../src/planning/types';

// ============================================================
// Types (local aliases for clarity)
// ============================================================

interface GrepMatch {
  file: string;
  line: number;
  text: string;
}

// ============================================================
// Mock Factories
// ============================================================

function makeToolCall(name: string, args: Record<string, unknown>): ToolCall {
  return { id: `call_${name}_${Date.now()}`, name, arguments: args };
}

function makeMockFs(overrides?: Partial<IFileSystem>): IFileSystem {
  return {
    readFile: vi.fn(),
    writeFile: vi.fn(),
    editFile: vi.fn(),
    deleteFile: vi.fn(),
    exists: vi.fn(),
    stat: vi.fn(),
    listDir: vi.fn(),
    watch: vi.fn() as any,
    join: vi.fn((...paths: string[]) => paths.join('/')),
    resolve: vi.fn((p: string) => p),
    relative: vi.fn(),
    dirname: vi.fn(),
    basename: vi.fn(),
    ...overrides,
  };
}

function makeMockProcess(overrides?: Partial<IProcess>): IProcess {
  return {
    exec: vi.fn(),
    spawn: vi.fn() as any,
    getEnv: vi.fn(),
    getCwd: vi.fn(),
    ...overrides,
  };
}

function makeMockSearch(overrides?: Partial<ISearch>): ISearch {
  return {
    grep: vi.fn(),
    glob: vi.fn(),
    ...overrides,
  };
}

function makeMockPlatform(overrides?: Partial<IPlatform>): IPlatform {
  return {
    type: 'electron' as const,
    capabilities: {
      filesystem: true,
      process: true,
      watch: false,
      mcpStdio: false,
      clipboard: false,
      notification: false,
    },
    fs: makeMockFs(),
    process: makeMockProcess(),
    storage: {} as any,
    search: makeMockSearch(),
    ...overrides,
  } as IPlatform;
}

function makeContext(platform?: Partial<IPlatform>): ToolContext {
  return {
    platform: makeMockPlatform(platform),
    sessionId: 'test-session',
    workingDir: '/project',
  };
}

// ============================================================
// BashExecutor
// ============================================================

describe('BashExecutor', () => {
  let executor: BashExecutor;
  let ctx: ToolContext;

  beforeEach(() => {
    executor = new BashExecutor();
    ctx = makeContext();
  });

  it('returns stdout and stderr on success', async () => {
    (ctx.platform.process.exec as ReturnType<typeof vi.fn>).mockResolvedValue({
      stdout: 'hello world',
      stderr: 'some warning',
      exitCode: 0,
      timedOut: false,
    } satisfies ExecResult);

    const result = await executor.execute(
      makeToolCall('bash', { command: 'echo hello' }),
      ctx,
    );

    expect(result.callId).toBeDefined();
    expect(result.output).toContain('hello world');
    expect(result.output).toContain('[stderr] some warning');
    expect(result.isError).toBe(false);
    expect(result.metadata).toMatchObject({ exitCode: 0, timedOut: false });
  });

  it('returns error when command is missing', async () => {
    const result = await executor.execute(
      makeToolCall('bash', {}),
      ctx,
    );

    expect(result.isError).toBe(true);
    expect(result.output).toContain('"command" is required');
  });

  it('returns error when command is not a string', async () => {
    const result = await executor.execute(
      makeToolCall('bash', { command: 123 }),
      ctx,
    );

    expect(result.isError).toBe(true);
    expect(result.output).toContain('"command" is required');
  });

  it('returns error when timeout is invalid (zero)', async () => {
    const result = await executor.execute(
      makeToolCall('bash', { command: 'ls', timeout: 0 }),
      ctx,
    );

    expect(result.isError).toBe(true);
    expect(result.output).toContain('"timeout" must be a positive number');
  });

  it('returns error when timeout is invalid (negative)', async () => {
    const result = await executor.execute(
      makeToolCall('bash', { command: 'ls', timeout: -100 }),
      ctx,
    );

    expect(result.isError).toBe(true);
    expect(result.output).toContain('"timeout" must be a positive number');
  });

  it('returns isError=true with exit code on non-zero exit', async () => {
    (ctx.platform.process.exec as ReturnType<typeof vi.fn>).mockResolvedValue({
      stdout: '',
      stderr: 'command not found',
      exitCode: 127,
      timedOut: false,
    } satisfies ExecResult);

    const result = await executor.execute(
      makeToolCall('bash', { command: 'badcmd' }),
      ctx,
    );

    expect(result.isError).toBe(true);
    expect(result.output).toContain('[exit code: 127]');
    expect(result.metadata).toMatchObject({ exitCode: 127 });
  });

  it('catches exec throws and returns error', async () => {
    (ctx.platform.process.exec as ReturnType<typeof vi.fn>).mockRejectedValue(
      new Error('spawn ENOENT'),
    );

    const result = await executor.execute(
      makeToolCall('bash', { command: 'ls' }),
      ctx,
    );

    expect(result.isError).toBe(true);
    expect(result.output).toContain('spawn ENOENT');
  });

  it('returns (no output) when stdout and stderr are empty', async () => {
    (ctx.platform.process.exec as ReturnType<typeof vi.fn>).mockResolvedValue({
      stdout: '',
      stderr: '',
      exitCode: 0,
      timedOut: false,
    } satisfies ExecResult);

    const result = await executor.execute(
      makeToolCall('bash', { command: 'true' }),
      ctx,
    );

    expect(result.output).toBe('(no output)');
  });

  it('passes cwd, timeout, and signal to exec', async () => {
    const mockExec = ctx.platform.process.exec as ReturnType<typeof vi.fn>;
    mockExec.mockResolvedValue({
      stdout: '',
      stderr: '',
      exitCode: 0,
      timedOut: false,
    });

    const signal = new AbortController().signal;
    const ctxWithSignal = { ...ctx, signal };

    await executor.execute(
      makeToolCall('bash', { command: 'ls', timeout: 5000 }),
      ctxWithSignal,
    );

    expect(mockExec).toHaveBeenCalledWith('ls', {
      cwd: '/project',
      timeout: 5000,
      signal,
    });
  });

  it('defaults timeout to 120000 when not provided', async () => {
    const mockExec = ctx.platform.process.exec as ReturnType<typeof vi.fn>;
    mockExec.mockResolvedValue({
      stdout: '',
      stderr: '',
      exitCode: 0,
      timedOut: false,
    });

    await executor.execute(
      makeToolCall('bash', { command: 'ls' }),
      ctx,
    );

    expect(mockExec).toHaveBeenCalledWith('ls', {
      cwd: '/project',
      timeout: 120000,
      signal: undefined,
    });
  });
});

// ============================================================
// FileReadExecutor
// ============================================================

describe('FileReadExecutor', () => {
  let executor: FileReadExecutor;
  let ctx: ToolContext;

  beforeEach(() => {
    executor = new FileReadExecutor();
    ctx = makeContext();
    // Default: join returns joined path, resolve returns same
    (ctx.platform.fs.join as ReturnType<typeof vi.fn>).mockImplementation(
      (...paths: string[]) => paths.join('/'),
    );
    (ctx.platform.fs.resolve as ReturnType<typeof vi.fn>).mockImplementation(
      (p: string) => p,
    );
  });

  it('returns file content with line numbers', async () => {
    (ctx.platform.fs.readFile as ReturnType<typeof vi.fn>).mockResolvedValue(
      'line one\nline two\nline three',
    );

    const result = await executor.execute(
      makeToolCall('file_read', { path: 'test.txt' }),
      ctx,
    );

    expect(result.output).toContain('1\tline one');
    expect(result.output).toContain('2\tline two');
    expect(result.output).toContain('3\tline three');
    expect(result.isError).toBeUndefined();
  });

  it('returns single numbered line for empty string content (split produces [""])', async () => {
    // An empty string '' splits into [''], giving one numbered line "1\t"
    (ctx.platform.fs.readFile as ReturnType<typeof vi.fn>).mockResolvedValue('');

    const result = await executor.execute(
      makeToolCall('file_read', { path: 'empty.txt' }),
      ctx,
    );

    // empty string → split → [''] → one line "1\t", not "(empty file)"
    expect(result.output).toBe('1\t');
  });

  it('returns (empty file) for content that results in no selected lines', async () => {
    // offset beyond file length → selectedLines is empty
    (ctx.platform.fs.readFile as ReturnType<typeof vi.fn>).mockResolvedValue('a\nb');

    const result = await executor.execute(
      makeToolCall('file_read', { path: 'short.txt', offset: 100 }),
      ctx,
    );

    expect(result.output).toBe('(empty file)');
  });

  it('applies offset to start from a given line', async () => {
    (ctx.platform.fs.readFile as ReturnType<typeof vi.fn>).mockResolvedValue(
      'a\nb\nc\nd\ne',
    );

    const result = await executor.execute(
      makeToolCall('file_read', { path: 'test.txt', offset: 3 }),
      ctx,
    );

    expect(result.output).toContain('3\tc');
    expect(result.output).toContain('4\td');
    expect(result.output).toContain('5\te');
    // Should NOT contain lines 1-2
    expect(result.output).not.toContain('1\ta');
    expect(result.output).not.toContain('2\tb');
  });

  it('applies limit to cap number of lines', async () => {
    // limit=2 → endLine = startLine(1) + 2 = 3 → slice(0,3) = 3 lines
    (ctx.platform.fs.readFile as ReturnType<typeof vi.fn>).mockResolvedValue(
      'a\nb\nc\nd\ne',
    );

    const result = await executor.execute(
      makeToolCall('file_read', { path: 'test.txt', limit: 2 }),
      ctx,
    );

    expect(result.output).toContain('1\ta');
    expect(result.output).toContain('2\tb');
    // limit=2 means endLine=3, so lines 1-3 are included
    expect(result.output).toContain('3\tc');
    expect(result.output).not.toContain('4\td');
  });

  it('applies both offset and limit', async () => {
    // offset=2, limit=2 → startLine=2, endLine=2+2=4 → slice(1,4) = lines at index 1,2,3
    (ctx.platform.fs.readFile as ReturnType<typeof vi.fn>).mockResolvedValue(
      'a\nb\nc\nd\ne',
    );

    const result = await executor.execute(
      makeToolCall('file_read', { path: 'test.txt', offset: 2, limit: 2 }),
      ctx,
    );

    expect(result.output).toContain('2\tb');
    expect(result.output).toContain('3\tc');
    expect(result.output).toContain('4\td');
    expect(result.output).not.toContain('1\ta');
    expect(result.output).not.toContain('5\te');
  });

  it('returns error when path is missing', async () => {
    const result = await executor.execute(
      makeToolCall('file_read', {}),
      ctx,
    );

    expect(result.isError).toBe(true);
    expect(result.output).toContain('"path" is required');
  });

  it('returns error when path is not a string', async () => {
    const result = await executor.execute(
      makeToolCall('file_read', { path: 42 }),
      ctx,
    );

    expect(result.isError).toBe(true);
    expect(result.output).toContain('"path" is required');
  });

  it('returns error for invalid offset (zero)', async () => {
    const result = await executor.execute(
      makeToolCall('file_read', { path: 'test.txt', offset: 0 }),
      ctx,
    );

    expect(result.isError).toBe(true);
    expect(result.output).toContain('"offset" must be a positive number');
  });

  it('returns error for invalid offset (negative)', async () => {
    const result = await executor.execute(
      makeToolCall('file_read', { path: 'test.txt', offset: -5 }),
      ctx,
    );

    expect(result.isError).toBe(true);
    expect(result.output).toContain('"offset" must be a positive number');
  });

  it('returns error for invalid limit', async () => {
    const result = await executor.execute(
      makeToolCall('file_read', { path: 'test.txt', limit: -1 }),
      ctx,
    );

    expect(result.isError).toBe(true);
    expect(result.output).toContain('"limit" must be a positive number');
  });

  it('catches readFile throws and returns error', async () => {
    (ctx.platform.fs.readFile as ReturnType<typeof vi.fn>).mockRejectedValue(
      new Error('ENOENT: no such file'),
    );

    const result = await executor.execute(
      makeToolCall('file_read', { path: 'missing.txt' }),
      ctx,
    );

    expect(result.isError).toBe(true);
    expect(result.output).toContain('ENOENT: no such file');
  });

  it('catches non-Error throws in readFile', async () => {
    (ctx.platform.fs.readFile as ReturnType<typeof vi.fn>).mockRejectedValue('string error');

    const result = await executor.execute(
      makeToolCall('file_read', { path: 'bad.txt' }),
      ctx,
    );

    expect(result.isError).toBe(true);
    expect(result.output).toContain('string error');
  });
});

// ============================================================
// FileWriteExecutor
// ============================================================

describe('FileWriteExecutor', () => {
  let executor: FileWriteExecutor;
  let ctx: ToolContext;

  beforeEach(() => {
    executor = new FileWriteExecutor();
    ctx = makeContext();
    (ctx.platform.fs.join as ReturnType<typeof vi.fn>).mockImplementation(
      (...paths: string[]) => paths.join('/'),
    );
    (ctx.platform.fs.resolve as ReturnType<typeof vi.fn>).mockImplementation(
      (p: string) => p,
    );
  });

  it('writes file and returns success message', async () => {
    (ctx.platform.fs.writeFile as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);

    const result = await executor.execute(
      makeToolCall('file_write', { path: 'output.txt', content: 'hello' }),
      ctx,
    );

    expect(ctx.platform.fs.writeFile).toHaveBeenCalledWith('/project/output.txt', 'hello');
    expect(result.output).toContain('File written successfully');
    expect(result.isError).toBeUndefined();
  });

  it('returns error when path is missing', async () => {
    const result = await executor.execute(
      makeToolCall('file_write', { content: 'hello' }),
      ctx,
    );

    expect(result.isError).toBe(true);
    expect(result.output).toContain('"path" is required');
  });

  it('returns error when path is not a string', async () => {
    const result = await executor.execute(
      makeToolCall('file_write', { path: null, content: 'hello' }),
      ctx,
    );

    expect(result.isError).toBe(true);
    expect(result.output).toContain('"path" is required');
  });

  it('returns error when content is missing (undefined)', async () => {
    const result = await executor.execute(
      makeToolCall('file_write', { path: 'test.txt' }),
      ctx,
    );

    expect(result.isError).toBe(true);
    expect(result.output).toContain('"content" is required');
  });

  it('returns error when content is null', async () => {
    const result = await executor.execute(
      makeToolCall('file_write', { path: 'test.txt', content: null }),
      ctx,
    );

    expect(result.isError).toBe(true);
    expect(result.output).toContain('"content" is required');
  });

  it('catches writeFile throws and returns error', async () => {
    (ctx.platform.fs.writeFile as ReturnType<typeof vi.fn>).mockRejectedValue(
      new Error('disk full'),
    );

    const result = await executor.execute(
      makeToolCall('file_write', { path: 'test.txt', content: 'data' }),
      ctx,
    );

    expect(result.isError).toBe(true);
    expect(result.output).toContain('disk full');
  });
});

// ============================================================
// FileEditExecutor
// ============================================================

describe('FileEditExecutor', () => {
  let executor: FileEditExecutor;
  let ctx: ToolContext;

  beforeEach(() => {
    executor = new FileEditExecutor();
    ctx = makeContext();
    (ctx.platform.fs.join as ReturnType<typeof vi.fn>).mockImplementation(
      (...paths: string[]) => paths.join('/'),
    );
    (ctx.platform.fs.resolve as ReturnType<typeof vi.fn>).mockImplementation(
      (p: string) => p,
    );
  });

  it('applies a single edit and returns diff', async () => {
    (ctx.platform.fs.readFile as ReturnType<typeof vi.fn>).mockResolvedValue(
      'const x = 1;\nconst y = 2;',
    );
    (ctx.platform.fs.editFile as ReturnType<typeof vi.fn>).mockResolvedValue(true);

    const result = await executor.execute(
      makeToolCall('file_edit', {
        path: 'code.ts',
        old_string: 'const x = 1;',
        new_string: 'const x = 42;',
      }),
      ctx,
    );

    expect(result.output).toContain('Edit applied');
    expect(result.isError).toBeUndefined();
    // When replace_all is false, editFile is called (not writeFile)
    expect(ctx.platform.fs.editFile).toHaveBeenCalledWith(
      expect.any(String),
      'const x = 1;',
      'const x = 42;',
    );
    // writeFile should NOT be called for single replace (editFile handles it)
    expect(ctx.platform.fs.writeFile).not.toHaveBeenCalled();
  });

  it('replaces all occurrences when replace_all is true', async () => {
    (ctx.platform.fs.readFile as ReturnType<typeof vi.fn>).mockResolvedValue(
      'foo bar foo baz foo',
    );
    (ctx.platform.fs.writeFile as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);

    const result = await executor.execute(
      makeToolCall('file_edit', {
        path: 'test.txt',
        old_string: 'foo',
        new_string: 'qux',
        replace_all: true,
      }),
      ctx,
    );

    expect(result.output).toContain('Replaced 3 occurrence(s)');
    expect(ctx.platform.fs.writeFile).toHaveBeenCalledWith(
      expect.any(String),
      'qux bar qux baz qux',
    );
  });

  it('returns error when old_string not found (single replace)', async () => {
    (ctx.platform.fs.readFile as ReturnType<typeof vi.fn>).mockResolvedValue('hello world');
    (ctx.platform.fs.editFile as ReturnType<typeof vi.fn>).mockResolvedValue(false);

    const result = await executor.execute(
      makeToolCall('file_edit', {
        path: 'test.txt',
        old_string: 'not found',
        new_string: 'replacement',
      }),
      ctx,
    );

    expect(result.isError).toBe(true);
    expect(result.output).toContain('old_string not found');
  });

  it('returns error when old_string not found (replace_all)', async () => {
    (ctx.platform.fs.readFile as ReturnType<typeof vi.fn>).mockResolvedValue('hello world');

    const result = await executor.execute(
      makeToolCall('file_edit', {
        path: 'test.txt',
        old_string: 'xyz',
        new_string: 'abc',
        replace_all: true,
      }),
      ctx,
    );

    expect(result.isError).toBe(true);
    expect(result.output).toContain('old_string not found');
  });

  it('returns error when path is missing', async () => {
    const result = await executor.execute(
      makeToolCall('file_edit', {
        old_string: 'a',
        new_string: 'b',
      }),
      ctx,
    );

    expect(result.isError).toBe(true);
    expect(result.output).toContain('"path" is required');
  });

  it('returns error when old_string is missing', async () => {
    const result = await executor.execute(
      makeToolCall('file_edit', {
        path: 'test.txt',
        new_string: 'b',
      }),
      ctx,
    );

    expect(result.isError).toBe(true);
    expect(result.output).toContain('"old_string" is required');
  });

  it('returns error when old_string is empty', async () => {
    const result = await executor.execute(
      makeToolCall('file_edit', {
        path: 'test.txt',
        old_string: '',
        new_string: 'b',
      }),
      ctx,
    );

    expect(result.isError).toBe(true);
    expect(result.output).toContain('"old_string" is required');
  });

  it('returns error when new_string is undefined', async () => {
    const result = await executor.execute(
      makeToolCall('file_edit', {
        path: 'test.txt',
        old_string: 'a',
      }),
      ctx,
    );

    expect(result.isError).toBe(true);
    expect(result.output).toContain('"new_string" is required');
  });

  it('returns error when new_string is null', async () => {
    const result = await executor.execute(
      makeToolCall('file_edit', {
        path: 'test.txt',
        old_string: 'a',
        new_string: null,
      }),
      ctx,
    );

    expect(result.isError).toBe(true);
    expect(result.output).toContain('"new_string" is required');
  });

  it('catches readFile throws and returns error', async () => {
    (ctx.platform.fs.readFile as ReturnType<typeof vi.fn>).mockRejectedValue(
      new Error('permission denied'),
    );

    const result = await executor.execute(
      makeToolCall('file_edit', {
        path: 'test.txt',
        old_string: 'a',
        new_string: 'b',
      }),
      ctx,
    );

    expect(result.isError).toBe(true);
    expect(result.output).toContain('permission denied');
  });
});

// ============================================================
// GrepExecutor
// ============================================================

describe('GrepExecutor', () => {
  let executor: GrepExecutor;
  let ctx: ToolContext;

  beforeEach(() => {
    executor = new GrepExecutor();
    ctx = makeContext();
    (ctx.platform.fs.join as ReturnType<typeof vi.fn>).mockImplementation(
      (...paths: string[]) => paths.join('/'),
    );
    (ctx.platform.fs.resolve as ReturnType<typeof vi.fn>).mockImplementation(
      (p: string) => p,
    );
  });

  it('returns formatted grep results', async () => {
    (ctx.platform.search.grep as ReturnType<typeof vi.fn>).mockResolvedValue([
      { file: '/project/a.ts', line: 10, text: 'const x = 1;' },
      { file: '/project/b.ts', line: 25, text: 'const x = 2;' },
    ]);

    const result = await executor.execute(
      makeToolCall('grep', { pattern: 'const x', path: '.' }),
      ctx,
    );

    expect(result.output).toContain('/project/a.ts:10: const x = 1;');
    expect(result.output).toContain('/project/b.ts:25: const x = 2;');
    expect(result.metadata).toMatchObject({ matchCount: 2 });
  });

  it('returns "No matches found" when results are empty', async () => {
    (ctx.platform.search.grep as ReturnType<typeof vi.fn>).mockResolvedValue([]);

    const result = await executor.execute(
      makeToolCall('grep', { pattern: 'nonexistent', path: '.' }),
      ctx,
    );

    expect(result.output).toBe('No matches found.');
  });

  it('returns error when pattern is missing', async () => {
    const result = await executor.execute(
      makeToolCall('grep', { path: '.' }),
      ctx,
    );

    expect(result.isError).toBe(true);
    expect(result.output).toContain('"pattern" is required');
  });

  it('returns error when path is missing', async () => {
    const result = await executor.execute(
      makeToolCall('grep', { pattern: 'test' }),
      ctx,
    );

    expect(result.isError).toBe(true);
    expect(result.output).toContain('"path" is required');
  });

  it('passes options to search.grep (ignoreCase, includePattern, maxResults)', async () => {
    const mockGrep = ctx.platform.search.grep as ReturnType<typeof vi.fn>;
    mockGrep.mockResolvedValue([]);

    await executor.execute(
      makeToolCall('grep', {
        pattern: 'TODO',
        path: 'src',
        ignore_case: true,
        include: '*.ts',
        max_results: 50,
      }),
      ctx,
    );

    expect(mockGrep).toHaveBeenCalledWith(
      'TODO',
      ['/project/src'],
      {
        ignoreCase: true,
        includePattern: '*.ts',
        maxResults: 50,
        contextLines: 2,
      },
    );
  });

  it('uses default maxResults of 250', async () => {
    const mockGrep = ctx.platform.search.grep as ReturnType<typeof vi.fn>;
    mockGrep.mockResolvedValue([]);

    await executor.execute(
      makeToolCall('grep', { pattern: 'test', path: '.' }),
      ctx,
    );

    expect(mockGrep).toHaveBeenCalledWith(
      expect.any(String),
      expect.any(Array),
      expect.objectContaining({ maxResults: 250 }),
    );
  });

  it('catches search.grep throws and returns error', async () => {
    (ctx.platform.search.grep as ReturnType<typeof vi.fn>).mockRejectedValue(
      new Error('regex invalid'),
    );

    const result = await executor.execute(
      makeToolCall('grep', { pattern: '[', path: '.' }),
      ctx,
    );

    expect(result.isError).toBe(true);
    expect(result.output).toContain('regex invalid');
  });
});

// ============================================================
// GlobExecutor
// ============================================================

describe('GlobExecutor', () => {
  let executor: GlobExecutor;
  let ctx: ToolContext;

  beforeEach(() => {
    executor = new GlobExecutor();
    ctx = makeContext();
    (ctx.platform.fs.join as ReturnType<typeof vi.fn>).mockImplementation(
      (...paths: string[]) => paths.join('/'),
    );
    (ctx.platform.fs.resolve as ReturnType<typeof vi.fn>).mockImplementation(
      (p: string) => p,
    );
  });

  it('returns matched file list', async () => {
    (ctx.platform.search.glob as ReturnType<typeof vi.fn>).mockResolvedValue([
      '/project/src/a.ts',
      '/project/src/b.ts',
    ]);

    const result = await executor.execute(
      makeToolCall('glob', { pattern: '**/*.ts' }),
      ctx,
    );

    expect(result.output).toContain('/project/src/a.ts');
    expect(result.output).toContain('/project/src/b.ts');
    expect(result.metadata).toMatchObject({ fileCount: 2 });
  });

  it('returns "No files matched" when no results', async () => {
    (ctx.platform.search.glob as ReturnType<typeof vi.fn>).mockResolvedValue([]);

    const result = await executor.execute(
      makeToolCall('glob', { pattern: '*.xyz' }),
      ctx,
    );

    expect(result.output).toBe('No files matched the pattern.');
  });

  it('returns error when pattern is missing', async () => {
    const result = await executor.execute(
      makeToolCall('glob', {}),
      ctx,
    );

    expect(result.isError).toBe(true);
    expect(result.output).toContain('"pattern" is required');
  });

  it('returns error when pattern is not a string', async () => {
    const result = await executor.execute(
      makeToolCall('glob', { pattern: 123 }),
      ctx,
    );

    expect(result.isError).toBe(true);
    expect(result.output).toContain('"pattern" is required');
  });

  it('uses workingDir as default search path when no path arg', async () => {
    const mockGlob = ctx.platform.search.glob as ReturnType<typeof vi.fn>;
    mockGlob.mockResolvedValue([]);

    await executor.execute(
      makeToolCall('glob', { pattern: '*.ts' }),
      ctx,
    );

    expect(mockGlob).toHaveBeenCalledWith('*.ts', '/project');
  });

  it('resolves custom path relative to workingDir', async () => {
    const mockGlob = ctx.platform.search.glob as ReturnType<typeof vi.fn>;
    mockGlob.mockResolvedValue([]);

    await executor.execute(
      makeToolCall('glob', { pattern: '*.ts', path: 'src' }),
      ctx,
    );

    // join is called with workingDir + path, then resolve on the result
    expect(ctx.platform.fs.join).toHaveBeenCalledWith('/project', 'src');
    expect(mockGlob).toHaveBeenCalledWith('*.ts', expect.any(String));
  });

  it('catches search.glob throws and returns error', async () => {
    (ctx.platform.search.glob as ReturnType<typeof vi.fn>).mockRejectedValue(
      new Error('glob error'),
    );

    const result = await executor.execute(
      makeToolCall('glob', { pattern: '*.ts' }),
      ctx,
    );

    expect(result.isError).toBe(true);
    expect(result.output).toContain('glob error');
  });
});

// ============================================================
// WebSearchExecutor
// ============================================================

describe('WebSearchExecutor', () => {
  let originalFetch: typeof globalThis.fetch;

  beforeEach(() => {
    originalFetch = globalThis.fetch;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it('fetches and returns JSON results', async () => {
    const mockData = { results: [{ title: 'Test', url: 'https://example.com' }] };
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockData),
    });

    const executor = new WebSearchExecutor('https://search.api/search');
    const ctx = makeContext();

    const result = await executor.execute(
      makeToolCall('web_search', { query: 'test query' }),
      ctx,
    );

    expect(result.output).toContain('Test');
    expect(result.isError).toBeUndefined();
    expect(globalThis.fetch).toHaveBeenCalledWith(
      'https://search.api/search?q=test%20query',
    );
  });

  it('returns error when no endpoint configured', async () => {
    const executor = new WebSearchExecutor(undefined);
    const ctx = makeContext();

    const result = await executor.execute(
      makeToolCall('web_search', { query: 'test' }),
      ctx,
    );

    expect(result.isError).toBe(true);
    expect(result.output).toContain('not configured');
  });

  it('returns error when query is missing', async () => {
    const executor = new WebSearchExecutor('https://search.api/search');
    const ctx = makeContext();

    const result = await executor.execute(
      makeToolCall('web_search', {}),
      ctx,
    );

    expect(result.isError).toBe(true);
    expect(result.output).toContain('"query" is required');
  });

  it('returns error when query is not a string', async () => {
    const executor = new WebSearchExecutor('https://search.api/search');
    const ctx = makeContext();

    const result = await executor.execute(
      makeToolCall('web_search', { query: 42 }),
      ctx,
    );

    expect(result.isError).toBe(true);
    expect(result.output).toContain('"query" is required');
  });

  it('catches fetch errors', async () => {
    globalThis.fetch = vi.fn().mockRejectedValue(new Error('network failure'));

    const executor = new WebSearchExecutor('https://search.api/search');
    const ctx = makeContext();

    const result = await executor.execute(
      makeToolCall('web_search', { query: 'test' }),
      ctx,
    );

    expect(result.isError).toBe(true);
    expect(result.output).toContain('network failure');
  });

  it('catches non-ok HTTP responses', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
    });

    const executor = new WebSearchExecutor('https://search.api/search');
    const ctx = makeContext();

    const result = await executor.execute(
      makeToolCall('web_search', { query: 'test' }),
      ctx,
    );

    expect(result.isError).toBe(true);
    expect(result.output).toContain('Search API returned 500');
  });

  it('returns string data directly when response is a string', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve('plain text result'),
    });

    const executor = new WebSearchExecutor('https://search.api/search');
    const ctx = makeContext();

    const result = await executor.execute(
      makeToolCall('web_search', { query: 'test' }),
      ctx,
    );

    expect(result.output).toBe('plain text result');
  });
});

// ============================================================
// WebFetchExecutor
// ============================================================

describe('WebFetchExecutor', () => {
  let originalFetch: typeof globalThis.fetch;

  beforeEach(() => {
    originalFetch = globalThis.fetch;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it('returns text content for successful fetch', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      headers: {
        get: (name: string) => {
          if (name === 'content-type') return 'text/html; charset=utf-8';
          return null;
        },
      },
      text: () => Promise.resolve('<h1>Hello World</h1>'),
    });

    const executor = new WebFetchExecutor();
    const ctx = makeContext();

    const result = await executor.execute(
      makeToolCall('web_fetch', { url: 'https://example.com' }),
      ctx,
    );

    expect(result.output).toContain('<h1>Hello World</h1>');
    expect(result.isError).toBeUndefined();
    expect(result.metadata).toMatchObject({
      url: 'https://example.com',
      contentType: 'text/html; charset=utf-8',
      status: 200,
    });
  });

  it('returns error when url is missing', async () => {
    const executor = new WebFetchExecutor();
    const ctx = makeContext();

    const result = await executor.execute(
      makeToolCall('web_fetch', {}),
      ctx,
    );

    expect(result.isError).toBe(true);
    expect(result.output).toContain('"url" is required');
  });

  it('returns error when url is not a string', async () => {
    const executor = new WebFetchExecutor();
    const ctx = makeContext();

    const result = await executor.execute(
      makeToolCall('web_fetch', { url: 123 }),
      ctx,
    );

    expect(result.isError).toBe(true);
    expect(result.output).toContain('"url" is required');
  });

  it('returns isError for HTTP error status', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 404,
      statusText: 'Not Found',
    });

    const executor = new WebFetchExecutor();
    const ctx = makeContext();

    const result = await executor.execute(
      makeToolCall('web_fetch', { url: 'https://example.com/missing' }),
      ctx,
    );

    expect(result.isError).toBe(true);
    expect(result.output).toContain('HTTP 404');
    expect(result.output).toContain('Not Found');
  });

  it('returns binary content info for non-text content types', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      headers: {
        get: (name: string) => {
          if (name === 'content-type') return 'application/pdf';
          if (name === 'content-length') return '12345';
          return null;
        },
      },
      text: () => Promise.resolve(''),
    });

    const executor = new WebFetchExecutor();
    const ctx = makeContext();

    const result = await executor.execute(
      makeToolCall('web_fetch', { url: 'https://example.com/doc.pdf' }),
      ctx,
    );

    expect(result.output).toContain('Binary content');
    expect(result.output).toContain('application/pdf');
    expect(result.output).toContain('12345 bytes');
  });

  it('truncates responses larger than 50000 chars', async () => {
    const largeContent = 'x'.repeat(55000);
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      headers: {
        get: (name: string) => {
          if (name === 'content-type') return 'text/plain';
          return null;
        },
      },
      text: () => Promise.resolve(largeContent),
    });

    const executor = new WebFetchExecutor();
    const ctx = makeContext();

    const result = await executor.execute(
      makeToolCall('web_fetch', { url: 'https://example.com/large' }),
      ctx,
    );

    expect(result.output).toHaveLength(50000 + '\n\n... (truncated)'.length);
    expect(result.output).toContain('... (truncated)');
  });

  it('catches fetch errors', async () => {
    globalThis.fetch = vi.fn().mockRejectedValue(new Error('connection refused'));

    const executor = new WebFetchExecutor();
    const ctx = makeContext();

    const result = await executor.execute(
      makeToolCall('web_fetch', { url: 'https://example.com' }),
      ctx,
    );

    expect(result.isError).toBe(true);
    expect(result.output).toContain('connection refused');
  });

  it('handles JSON content type as text', async () => {
    const jsonData = '{"key": "value"}';
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      headers: {
        get: (name: string) => {
          if (name === 'content-type') return 'application/json';
          return null;
        },
      },
      text: () => Promise.resolve(jsonData),
    });

    const executor = new WebFetchExecutor();
    const ctx = makeContext();

    const result = await executor.execute(
      makeToolCall('web_fetch', { url: 'https://api.example.com/data' }),
      ctx,
    );

    expect(result.output).toBe(jsonData);
  });
});

// ============================================================
// MemorySaveExecutor
// ============================================================

describe('MemorySaveExecutor', () => {
  it('calls saveAutoMemory and returns success', async () => {
    const mockManager = {
      saveAutoMemory: vi.fn().mockResolvedValue(undefined),
    };

    const executor = new MemorySaveExecutor(mockManager as any);
    const ctx = makeContext();

    const result = await executor.execute(
      makeToolCall('memory_save', { content: 'User prefers TypeScript' }),
      ctx,
    );

    expect(mockManager.saveAutoMemory).toHaveBeenCalledWith('User prefers TypeScript', 'general');
    expect(result.output).toContain('Saved to memory');
    expect(result.output).toContain('User prefers TypeScript');
    expect(result.isError).toBeUndefined();
  });

  it('passes custom category to saveAutoMemory', async () => {
    const mockManager = {
      saveAutoMemory: vi.fn().mockResolvedValue(undefined),
    };

    const executor = new MemorySaveExecutor(mockManager as any);
    const ctx = makeContext();

    await executor.execute(
      makeToolCall('memory_save', { content: 'some fact', category: 'preferences' }),
      ctx,
    );

    expect(mockManager.saveAutoMemory).toHaveBeenCalledWith('some fact', 'preferences');
  });

  it('returns error when content is missing', async () => {
    const mockManager = { saveAutoMemory: vi.fn() };
    const executor = new MemorySaveExecutor(mockManager as any);
    const ctx = makeContext();

    const result = await executor.execute(
      makeToolCall('memory_save', {}),
      ctx,
    );

    expect(result.isError).toBe(true);
    expect(result.output).toContain('"content" is required');
    expect(mockManager.saveAutoMemory).not.toHaveBeenCalled();
  });

  it('returns error when content is not a string', async () => {
    const mockManager = { saveAutoMemory: vi.fn() };
    const executor = new MemorySaveExecutor(mockManager as any);
    const ctx = makeContext();

    const result = await executor.execute(
      makeToolCall('memory_save', { content: 123 }),
      ctx,
    );

    expect(result.isError).toBe(true);
    expect(result.output).toContain('"content" is required');
  });

  it('catches saveAutoMemory throws', async () => {
    const mockManager = {
      saveAutoMemory: vi.fn().mockRejectedValue(new Error('storage full')),
    };

    const executor = new MemorySaveExecutor(mockManager as any);
    const ctx = makeContext();

    const result = await executor.execute(
      makeToolCall('memory_save', { content: 'data' }),
      ctx,
    );

    expect(result.isError).toBe(true);
    expect(result.output).toContain('storage full');
  });

  it('trims content and truncates long content in output', async () => {
    const longContent = 'a'.repeat(100);
    const mockManager = {
      saveAutoMemory: vi.fn().mockResolvedValue(undefined),
    };

    const executor = new MemorySaveExecutor(mockManager as any);
    const ctx = makeContext();

    const result = await executor.execute(
      makeToolCall('memory_save', { content: ` ${longContent} ` }),
      ctx,
    );

    // saveAutoMemory should receive trimmed content
    expect(mockManager.saveAutoMemory).toHaveBeenCalledWith(longContent, 'general');
    // Output should show first 80 chars with ...
    expect(result.output).toContain('...');
  });
});

// ============================================================
// MemoryRecallExecutor
// ============================================================

describe('MemoryRecallExecutor', () => {
  it('returns all memories when no keyword', async () => {
    const mockManager = {
      getAllMemoryText: vi.fn().mockReturnValue(
        '## Project Rules & Context\nProject rule 1\n\n## Learned Preferences\n- pref 1\n- pref 2',
      ),
    };

    const executor = new MemoryRecallExecutor(mockManager as any);
    const ctx = makeContext();

    const result = await executor.execute(
      makeToolCall('memory_recall', {}),
      ctx,
    );

    expect(result.output).toContain('Project rule 1');
    expect(result.output).toContain('pref 1');
    expect(result.isError).toBeUndefined();
  });

  it('filters memories by keyword (case-insensitive)', async () => {
    const mockManager = {
      getAllMemoryText: vi.fn().mockReturnValue(
        '- User prefers TypeScript\n- Project uses pnpm\n- User likes dark mode',
      ),
    };

    const executor = new MemoryRecallExecutor(mockManager as any);
    const ctx = makeContext();

    const result = await executor.execute(
      makeToolCall('memory_recall', { keyword: 'typescript' }),
      ctx,
    );

    expect(result.output).toContain('User prefers TypeScript');
    expect(result.output).not.toContain('pnpm');
  });

  it('returns "No memories saved yet" when empty', async () => {
    const mockManager = {
      getAllMemoryText: vi.fn().mockReturnValue(''),
    };

    const executor = new MemoryRecallExecutor(mockManager as any);
    const ctx = makeContext();

    const result = await executor.execute(
      makeToolCall('memory_recall', {}),
      ctx,
    );

    expect(result.output).toBe('No memories saved yet.');
  });

  it('returns "No memories matching" when keyword finds nothing', async () => {
    const mockManager = {
      getAllMemoryText: vi.fn().mockReturnValue('- some memory\n- another memory'),
    };

    const executor = new MemoryRecallExecutor(mockManager as any);
    const ctx = makeContext();

    const result = await executor.execute(
      makeToolCall('memory_recall', { keyword: 'nonexistent' }),
      ctx,
    );

    expect(result.output).toContain('No memories matching "nonexistent"');
  });

  it('catches getAllMemoryText throws', async () => {
    const mockManager = {
      getAllMemoryText: vi.fn().mockImplementation(() => {
        throw new Error('read error');
      }),
    };

    const executor = new MemoryRecallExecutor(mockManager as any);
    const ctx = makeContext();

    const result = await executor.execute(
      makeToolCall('memory_recall', {}),
      ctx,
    );

    expect(result.isError).toBe(true);
    expect(result.output).toContain('read error');
  });
});

// ============================================================
// PlanCreateExecutor
// ============================================================

describe('PlanCreateExecutor', () => {
  function makeMockPlanningManager() {
    const plans = new Map<string, Plan>();

    return {
      createPlan: vi.fn((title: string, steps: Array<{ title: string; description: string }>) => {
        const planId = `plan_1_${Date.now()}`;
        const plan: Plan = {
          id: planId,
          title,
          steps: steps.map((s, i) => ({
            id: `step_${i + 1}`,
            title: s.title,
            description: s.description,
            status: 'pending' as const,
          })),
          createdAt: Date.now(),
          updatedAt: Date.now(),
        };
        plans.set(planId, plan);
        return plan;
      }),
      getPlan: vi.fn((id: string) => plans.get(id) ?? null),
      getNextStep: vi.fn((id: string) => {
        const plan = plans.get(id);
        if (!plan) return null;
        return plan.steps.find((s) => s.status === 'pending') ?? null;
      }),
      getProgress: vi.fn((id: string) => {
        const plan = plans.get(id);
        if (!plan) return { total: 0, completed: 0, failed: 0, pending: 0 };
        return {
          total: plan.steps.length,
          completed: plan.steps.filter((s) => s.status === 'completed').length,
          failed: plan.steps.filter((s) => s.status === 'failed').length,
          pending: plan.steps.filter((s) => s.status === 'pending').length,
        };
      }),
      updateStepStatus: vi.fn((planId: string, stepId: string, status: string) => {
        const plan = plans.get(planId);
        if (!plan) return false;
        const step = plan.steps.find((s) => s.id === stepId);
        if (!step) return false;
        step.status = status as any;
        return true;
      }),
      formatPlan: vi.fn((id: string) => {
        const plan = plans.get(id);
        if (!plan) return '';
        return `# ${plan.title}\nPlan ID: ${plan.id}\n\n${plan.steps.map((s) => `[ ] ${s.id}: ${s.title}`).join('\n')}`;
      }),
    };
  }

  it('creates a plan and returns formatted output', async () => {
    const mockPM = makeMockPlanningManager();
    const executor = new PlanCreateExecutor(mockPM as any);

    const result = await executor.execute(
      makeToolCall('plan_create', {
        title: 'Test Plan',
        steps: [
          { title: 'Step 1', description: 'First step' },
          { title: 'Step 2', description: 'Second step' },
        ],
      }),
    );

    expect(mockPM.createPlan).toHaveBeenCalledWith('Test Plan', [
      { title: 'Step 1', description: 'First step' },
      { title: 'Step 2', description: 'Second step' },
    ]);
    expect(result.output).toContain('Test Plan');
    expect(result.isError).toBeUndefined();
    expect(result.metadata).toBeDefined();
    expect(result.metadata!.planProgress).toBeDefined();
  });

  it('returns error when title is missing', async () => {
    const mockPM = makeMockPlanningManager();
    const executor = new PlanCreateExecutor(mockPM as any);

    const result = await executor.execute(
      makeToolCall('plan_create', {
        steps: [{ title: 'Step 1', description: 'First' }],
      }),
    );

    expect(result.isError).toBe(true);
    expect(result.output).toContain('"title" is required');
  });

  it('returns error when title is not a string', async () => {
    const mockPM = makeMockPlanningManager();
    const executor = new PlanCreateExecutor(mockPM as any);

    const result = await executor.execute(
      makeToolCall('plan_create', {
        title: 123,
        steps: [{ title: 'Step 1', description: 'First' }],
      }),
    );

    expect(result.isError).toBe(true);
    expect(result.output).toContain('"title" is required');
  });

  it('returns error when steps is missing', async () => {
    const mockPM = makeMockPlanningManager();
    const executor = new PlanCreateExecutor(mockPM as any);

    const result = await executor.execute(
      makeToolCall('plan_create', { title: 'Plan' }),
    );

    expect(result.isError).toBe(true);
    expect(result.output).toContain('"steps" is required');
  });

  it('returns error when steps is an empty array', async () => {
    const mockPM = makeMockPlanningManager();
    const executor = new PlanCreateExecutor(mockPM as any);

    const result = await executor.execute(
      makeToolCall('plan_create', { title: 'Plan', steps: [] }),
    );

    expect(result.isError).toBe(true);
    expect(result.output).toContain('"steps" is required');
  });

  it('returns error when steps is not an array', async () => {
    const mockPM = makeMockPlanningManager();
    const executor = new PlanCreateExecutor(mockPM as any);

    const result = await executor.execute(
      makeToolCall('plan_create', { title: 'Plan', steps: 'not array' }),
    );

    expect(result.isError).toBe(true);
    expect(result.output).toContain('"steps" is required');
  });
});

// ============================================================
// PlanGetStatusExecutor
// ============================================================

describe('PlanGetStatusExecutor', () => {
  function makeMockPM() {
    const plan: Plan = {
      id: 'plan_1',
      title: 'Test Plan',
      steps: [
        { id: 'step_1', title: 'First', description: 'Step 1', status: 'completed' },
        { id: 'step_2', title: 'Second', description: 'Step 2', status: 'pending' },
        { id: 'step_3', title: 'Third', description: 'Step 3', status: 'pending' },
      ],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    return {
      getPlan: vi.fn((id: string) => (id === 'plan_1' ? plan : null)),
      getNextStep: vi.fn((id: string) => {
        if (id !== 'plan_1') return null;
        return plan.steps.find((s) => s.status === 'pending') ?? null;
      }),
      getProgress: vi.fn((id: string) => {
        if (id !== 'plan_1') return { total: 0, completed: 0, failed: 0, pending: 0 };
        return {
          total: 3,
          completed: 1,
          failed: 0,
          pending: 2,
        };
      }),
      formatPlan: vi.fn((id: string) => {
        if (id !== 'plan_1') return '';
        return '# Test Plan\nPlan ID: plan_1\n\n[x] step_1: First\n[ ] step_2: Second\n[ ] step_3: Third';
      }),
    };
  }

  it('returns formatted plan with progress info', async () => {
    const mockPM = makeMockPM();
    const executor = new PlanGetStatusExecutor(mockPM as any);

    const result = await executor.execute(
      makeToolCall('plan_get_status', { planId: 'plan_1' }),
    );

    expect(result.output).toContain('Test Plan');
    expect(result.output).toContain('Progress: 1/3 completed');
    expect(result.output).toContain('Next step: step_2: Second');
    expect(result.metadata).toBeDefined();
    expect(result.isError).toBeUndefined();
  });

  it('returns error when planId is missing', async () => {
    const mockPM = makeMockPM();
    const executor = new PlanGetStatusExecutor(mockPM as any);

    const result = await executor.execute(
      makeToolCall('plan_get_status', {}),
    );

    expect(result.isError).toBe(true);
    expect(result.output).toContain('"planId" is required');
  });

  it('returns error when planId is not a string', async () => {
    const mockPM = makeMockPM();
    const executor = new PlanGetStatusExecutor(mockPM as any);

    const result = await executor.execute(
      makeToolCall('plan_get_status', { planId: 42 }),
    );

    expect(result.isError).toBe(true);
    expect(result.output).toContain('"planId" is required');
  });

  it('returns error when plan not found', async () => {
    const mockPM = makeMockPM();
    const executor = new PlanGetStatusExecutor(mockPM as any);

    const result = await executor.execute(
      makeToolCall('plan_get_status', { planId: 'nonexistent' }),
    );

    expect(result.isError).toBe(true);
    expect(result.output).toContain('not found');
  });
});

// ============================================================
// PlanUpdateStepExecutor
// ============================================================

describe('PlanUpdateStepExecutor', () => {
  function makeMockPM() {
    const plan: Plan = {
      id: 'plan_1',
      title: 'Test Plan',
      steps: [
        { id: 'step_1', title: 'First', description: 'Step 1', status: 'pending' },
        { id: 'step_2', title: 'Second', description: 'Step 2', status: 'pending' },
      ],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    return {
      getPlan: vi.fn((id: string) => (id === 'plan_1' ? plan : null)),
      updateStepStatus: vi.fn((planId: string, stepId: string, status: string, result?: string) => {
        if (planId !== 'plan_1') return false;
        const step = plan.steps.find((s) => s.id === stepId);
        if (!step) return false;
        step.status = status as any;
        if (result !== undefined) step.result = result;
        return true;
      }),
      formatPlan: vi.fn((id: string) => {
        if (id !== 'plan_1') return '';
        return `# Test Plan\nPlan ID: plan_1\n\n${plan.steps.map((s) => `[${s.status === 'completed' ? 'x' : ' '}] ${s.id}: ${s.title}`).join('\n')}`;
      }),
    };
  }

  it('updates step and returns formatted plan', async () => {
    const mockPM = makeMockPM();
    const executor = new PlanUpdateStepExecutor(mockPM as any);

    const result = await executor.execute(
      makeToolCall('plan_update_step', {
        planId: 'plan_1',
        stepId: 'step_1',
        status: 'completed',
        result: 'Done successfully',
      }),
    );

    expect(result.output).toContain('Step step_1 marked as completed');
    expect(result.output).toContain('Test Plan');
    expect(mockPM.updateStepStatus).toHaveBeenCalledWith(
      'plan_1', 'step_1', 'completed', 'Done successfully',
    );
    expect(result.isError).toBeUndefined();
  });

  it('returns error when planId is missing', async () => {
    const mockPM = makeMockPM();
    const executor = new PlanUpdateStepExecutor(mockPM as any);

    const result = await executor.execute(
      makeToolCall('plan_update_step', {
        stepId: 'step_1',
        status: 'completed',
      }),
    );

    expect(result.isError).toBe(true);
    expect(result.output).toContain('"planId" is required');
  });

  it('returns error when stepId is missing', async () => {
    const mockPM = makeMockPM();
    const executor = new PlanUpdateStepExecutor(mockPM as any);

    const result = await executor.execute(
      makeToolCall('plan_update_step', {
        planId: 'plan_1',
        status: 'completed',
      }),
    );

    expect(result.isError).toBe(true);
    expect(result.output).toContain('"stepId" is required');
  });

  it('returns error when status is missing', async () => {
    const mockPM = makeMockPM();
    const executor = new PlanUpdateStepExecutor(mockPM as any);

    const result = await executor.execute(
      makeToolCall('plan_update_step', {
        planId: 'plan_1',
        stepId: 'step_1',
      }),
    );

    expect(result.isError).toBe(true);
    expect(result.output).toContain('"status" must be one of');
  });

  it('returns error when status is invalid', async () => {
    const mockPM = makeMockPM();
    const executor = new PlanUpdateStepExecutor(mockPM as any);

    const result = await executor.execute(
      makeToolCall('plan_update_step', {
        planId: 'plan_1',
        stepId: 'step_1',
        status: 'invalid_status',
      }),
    );

    expect(result.isError).toBe(true);
    expect(result.output).toContain('"status" must be one of');
  });

  it('accepts "in_progress" as valid status', async () => {
    const mockPM = makeMockPM();
    const executor = new PlanUpdateStepExecutor(mockPM as any);

    const result = await executor.execute(
      makeToolCall('plan_update_step', {
        planId: 'plan_1',
        stepId: 'step_1',
        status: 'in_progress',
      }),
    );

    expect(result.isError).toBeUndefined();
    expect(result.output).toContain('marked as in_progress');
  });

  it('returns error when plan not found', async () => {
    const mockPM = makeMockPM();
    const executor = new PlanUpdateStepExecutor(mockPM as any);

    const result = await executor.execute(
      makeToolCall('plan_update_step', {
        planId: 'nonexistent_plan',
        stepId: 'step_1',
        status: 'completed',
      }),
    );

    expect(result.isError).toBe(true);
    expect(result.output).toContain('not found');
    expect(result.output).toContain('plan_create');
  });

  it('returns error when step not found', async () => {
    const mockPM = makeMockPM();
    const executor = new PlanUpdateStepExecutor(mockPM as any);

    const result = await executor.execute(
      makeToolCall('plan_update_step', {
        planId: 'plan_1',
        stepId: 'step_999',
        status: 'completed',
      }),
    );

    expect(result.isError).toBe(true);
    expect(result.output).toContain('Step "step_999" not found');
    expect(result.output).toContain('Available steps');
  });

  it('returns error when updateStepStatus returns false', async () => {
    const mockPM = makeMockPM();
    mockPM.updateStepStatus = vi.fn().mockReturnValue(false);
    const executor = new PlanUpdateStepExecutor(mockPM as any);

    const result = await executor.execute(
      makeToolCall('plan_update_step', {
        planId: 'plan_1',
        stepId: 'step_1',
        status: 'completed',
      }),
    );

    expect(result.isError).toBe(true);
    expect(result.output).toContain('Failed to update step');
  });
});
