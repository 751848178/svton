import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Direct imports from source modules
import { BashExecutor } from '../src/tool/builtins/shell';
import { FileReadExecutor, FileWriteExecutor, FileEditExecutor } from '../src/tool/builtins/file';
import { GrepExecutor, GlobExecutor } from '../src/tool/builtins/search';
import { WebSearchExecutor, WebFetchExecutor, createWebSearchExecutor } from '../src/tool/builtins/web';
import type { WebSearchConfig } from '../src/tool/builtins/web';
import { MemorySaveExecutor, MemoryRecallExecutor } from '../src/tool/builtins/memory';
import { PlanCreateExecutor, PlanGetStatusExecutor, PlanUpdateStepExecutor } from '../src/tool/builtins/planning';

import type { ToolCall, ToolResult, ToolContext } from '../src/tool/types';
import type { IPlatform, IFileSystem, IProcess, ISearch, ExecResult, SandboxProfile } from '@svton/agent-platform';
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
    expect(result.metadata).toMatchObject({
      exitCode: 0,
      timedOut: false,
      command: 'echo hello',
      timeout: 120000,
    });
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

  it('returns error when command is blank', async () => {
    const mockExec = ctx.platform.process.exec as ReturnType<typeof vi.fn>;

    const result = await executor.execute(
      makeToolCall('bash', { command: '   ' }),
      ctx,
    );

    expect(result.isError).toBe(true);
    expect(result.output).toContain('"command" is required');
    expect(mockExec).not.toHaveBeenCalled();
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

  it('returns error when timeout is not finite', async () => {
    const mockExec = ctx.platform.process.exec as ReturnType<typeof vi.fn>;

    const result = await executor.execute(
      makeToolCall('bash', { command: 'ls', timeout: Number.POSITIVE_INFINITY }),
      ctx,
    );

    expect(result.isError).toBe(true);
    expect(result.output).toContain('"timeout" must be a positive number');
    expect(mockExec).not.toHaveBeenCalled();
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

  it('returns isError=true when command execution times out', async () => {
    (ctx.platform.process.exec as ReturnType<typeof vi.fn>).mockResolvedValue({
      stdout: '',
      stderr: '',
      exitCode: null,
      timedOut: true,
    } satisfies ExecResult);

    const result = await executor.execute(
      makeToolCall('bash', { command: 'sleep 10', timeout: 1 }),
      ctx,
    );

    expect(result.isError).toBe(true);
    expect(result.output).toContain('[timed out]');
    expect(result.metadata).toMatchObject({ exitCode: null, timedOut: true });
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
    expect(result.metadata).toMatchObject({
      command: 'ls',
      timeout: 120000,
    });
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

    const result = await executor.execute(
      makeToolCall('bash', { command: 'ls', timeout: 5000 }),
      ctxWithSignal,
    );

    expect(mockExec).toHaveBeenCalledWith('ls', {
      cwd: '/project',
      timeout: 5000,
      signal,
    });
    expect(result.metadata).toMatchObject({ command: 'ls', timeout: 5000 });
  });

  it('uses sandbox exec when sandbox profile is available', async () => {
    const sandboxProfile: SandboxProfile = {
      mode: 'workspace_write',
      writablePaths: ['/project'],
      networkAccess: false,
    };
    const sandboxExec = vi.fn(async (): Promise<ExecResult> => ({
      stdout: 'sandboxed',
      stderr: '',
      exitCode: 0,
      timedOut: false,
    }));
    const mockExec = ctx.platform.process.exec as ReturnType<typeof vi.fn>;
    (ctx.platform as any).sandbox = {
      createProfile: vi.fn(),
      exec: sandboxExec,
    };

    const signal = new AbortController().signal;
    const ctxWithSandbox = { ...ctx, sandboxProfile, signal };
    const result = await executor.execute(
      makeToolCall('bash', { command: 'pwd', timeout: 5000 }),
      ctxWithSandbox,
    );

    expect(result.output).toBe('sandboxed');
    expect(sandboxExec).toHaveBeenCalledWith('pwd', {
      cwd: '/project',
      timeout: 5000,
      signal,
    }, sandboxProfile);
    expect(mockExec).not.toHaveBeenCalled();
  });

  it('falls back to process exec on legacy platforms when sandbox profile is absent', async () => {
    const mockExec = ctx.platform.process.exec as ReturnType<typeof vi.fn>;
    const sandboxExec = vi.fn();
    mockExec.mockResolvedValue({
      stdout: 'process',
      stderr: '',
      exitCode: 0,
      timedOut: false,
    });
    (ctx.platform as any).sandbox = {
      createProfile: vi.fn(),
      exec: sandboxExec,
    };

    const result = await executor.execute(
      makeToolCall('bash', { command: 'pwd' }),
      ctx,
    );

    expect(result.output).toBe('process');
    expect(mockExec).toHaveBeenCalledWith('pwd', {
      cwd: '/project',
      timeout: 120000,
      signal: undefined,
    });
    expect(sandboxExec).not.toHaveBeenCalled();
  });

  it('fails closed when sandbox is required but the profile is absent', async () => {
    const mockExec = ctx.platform.process.exec as ReturnType<typeof vi.fn>;
    const sandboxExec = vi.fn();
    (ctx.platform as any).sandbox = {
      createProfile: vi.fn(),
      exec: sandboxExec,
    };
    const result = await executor.execute(
      makeToolCall('bash', { command: 'pwd' }),
      { ...ctx, sandboxRequired: true },
    );

    expect(result.isError).toBe(true);
    expect(result.output).toContain('requires sandbox execution');
    expect(result.metadata).toMatchObject({ command: 'pwd', timeout: 120000 });
    expect(mockExec).not.toHaveBeenCalled();
    expect(sandboxExec).not.toHaveBeenCalled();
  });

  it('fails closed when sandbox is required but the platform sandbox is absent', async () => {
    const mockExec = ctx.platform.process.exec as ReturnType<typeof vi.fn>;
    const sandboxProfile: SandboxProfile = {
      mode: 'workspace_write',
      writablePaths: ['/project'],
      networkAccess: false,
    };
    const result = await executor.execute(
      makeToolCall('bash', { command: 'pwd' }),
      { ...ctx, sandboxProfile, sandboxRequired: true },
    );

    expect(result.isError).toBe(true);
    expect(result.output).toContain('requires sandbox execution');
    expect(result.metadata).toMatchObject({ command: 'pwd', timeout: 120000 });
    expect(mockExec).not.toHaveBeenCalled();
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

  it('returns empty file output and metadata for empty string content', async () => {
    (ctx.platform.fs.readFile as ReturnType<typeof vi.fn>).mockResolvedValue('');

    const result = await executor.execute(
      makeToolCall('file_read', { path: 'empty.txt' }),
      ctx,
    );

    expect(result.output).toBe('(empty file)');
    expect(result.metadata).toMatchObject({
      path: '/project/empty.txt',
      startLine: 1,
      endLine: null,
      returnedLines: 0,
      totalLines: 0,
    });
  });

  it('does not invent a blank final line for newline-terminated content', async () => {
    (ctx.platform.fs.readFile as ReturnType<typeof vi.fn>).mockResolvedValue('a\nb\n');

    const result = await executor.execute(
      makeToolCall('file_read', { path: 'ending-newline.txt' }),
      ctx,
    );

    expect(result.output).toBe('1\ta\n2\tb');
    expect(result.metadata).toMatchObject({
      path: '/project/ending-newline.txt',
      startLine: 1,
      endLine: 2,
      returnedLines: 2,
      totalLines: 2,
    });
  });

  it('normalizes CRLF line endings in numbered file output', async () => {
    (ctx.platform.fs.readFile as ReturnType<typeof vi.fn>).mockResolvedValue('a\r\nb\r\n');

    const result = await executor.execute(
      makeToolCall('file_read', { path: 'windows.txt' }),
      ctx,
    );

    expect(result.output).toBe('1\ta\n2\tb');
    expect(result.metadata).toMatchObject({
      path: '/project/windows.txt',
      startLine: 1,
      endLine: 2,
      returnedLines: 2,
      totalLines: 2,
    });
  });

  it('returns no selected lines metadata when offset is beyond file length', async () => {
    // offset beyond file length → selectedLines is empty
    (ctx.platform.fs.readFile as ReturnType<typeof vi.fn>).mockResolvedValue('a\nb');

    const result = await executor.execute(
      makeToolCall('file_read', { path: 'short.txt', offset: 100 }),
      ctx,
    );

    expect(result.output).toBe('(no lines selected)');
    expect(result.metadata).toMatchObject({
      path: '/project/short.txt',
      startLine: 100,
      returnedLines: 0,
      totalLines: 2,
    });
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
    (ctx.platform.fs.readFile as ReturnType<typeof vi.fn>).mockResolvedValue(
      'a\nb\nc\nd\ne',
    );

    const result = await executor.execute(
      makeToolCall('file_read', { path: 'test.txt', limit: 2 }),
      ctx,
    );

    expect(result.output).toContain('1\ta');
    expect(result.output).toContain('2\tb');
    expect(result.output).not.toContain('3\tc');
    expect(result.output).not.toContain('4\td');
  });

  it('applies both offset and limit', async () => {
    (ctx.platform.fs.readFile as ReturnType<typeof vi.fn>).mockResolvedValue(
      'a\nb\nc\nd\ne',
    );

    const result = await executor.execute(
      makeToolCall('file_read', { path: 'test.txt', offset: 2, limit: 2 }),
      ctx,
    );

    expect(result.output).toContain('2\tb');
    expect(result.output).toContain('3\tc');
    expect(result.output).not.toContain('4\td');
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

  it('returns error when path is blank before reading', async () => {
    const result = await executor.execute(
      makeToolCall('file_read', { path: '  \n\t  ' }),
      ctx,
    );

    expect(result.isError).toBe(true);
    expect(result.output).toContain('"path" is required');
    expect(ctx.platform.fs.resolve).not.toHaveBeenCalled();
    expect(ctx.platform.fs.readFile).not.toHaveBeenCalled();
  });

  it('uses the trimmed path before resolving the read target', async () => {
    (ctx.platform.fs.readFile as ReturnType<typeof vi.fn>).mockResolvedValue('content');

    await executor.execute(
      makeToolCall('file_read', { path: '  src/a.ts\n' }),
      ctx,
    );

    expect(ctx.platform.fs.join).toHaveBeenCalledWith('/project', 'src/a.ts');
    expect(ctx.platform.fs.resolve).toHaveBeenCalledWith('/project/src/a.ts');
    expect(ctx.platform.fs.readFile).toHaveBeenCalledWith('/project/src/a.ts');
  });

  it('preserves absolute file_read paths instead of joining them to workingDir', async () => {
    (ctx.platform.fs.readFile as ReturnType<typeof vi.fn>).mockResolvedValue('content');

    await executor.execute(
      makeToolCall('file_read', { path: '/tmp/project/a.ts' }),
      ctx,
    );

    expect(ctx.platform.fs.join).not.toHaveBeenCalled();
    expect(ctx.platform.fs.resolve).toHaveBeenCalledWith('/tmp/project/a.ts');
    expect(ctx.platform.fs.readFile).toHaveBeenCalledWith('/tmp/project/a.ts');
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

  it('rejects non-integer and non-finite offsets before reading', async () => {
    for (const offset of [1.5, Number.NaN, Number.POSITIVE_INFINITY]) {
      const result = await executor.execute(
        makeToolCall('file_read', { path: 'test.txt', offset }),
        ctx,
      );

      expect(result.isError).toBe(true);
      expect(result.output).toContain('"offset" must be a positive number');
    }
    expect(ctx.platform.fs.readFile).not.toHaveBeenCalled();
  });

  it('returns error for invalid limit', async () => {
    const result = await executor.execute(
      makeToolCall('file_read', { path: 'test.txt', limit: -1 }),
      ctx,
    );

    expect(result.isError).toBe(true);
    expect(result.output).toContain('"limit" must be a positive number');
  });

  it('rejects non-integer and non-finite limits before reading', async () => {
    for (const limit of [1.5, Number.NaN, Number.POSITIVE_INFINITY]) {
      const result = await executor.execute(
        makeToolCall('file_read', { path: 'test.txt', limit }),
        ctx,
      );

      expect(result.isError).toBe(true);
      expect(result.output).toContain('"limit" must be a positive number');
    }
    expect(ctx.platform.fs.readFile).not.toHaveBeenCalled();
  });

  it('catches readFile throws and returns error', async () => {
    (ctx.platform.fs.readFile as ReturnType<typeof vi.fn>).mockRejectedValue(
      new Error('ENOENT: no such file'),
    );

    const result = await executor.execute(
      makeToolCall('file_read', { path: 'missing.txt', offset: 5, limit: 2 }),
      ctx,
    );

    expect(result.isError).toBe(true);
    expect(result.output).toContain('ENOENT: no such file');
    expect(result.metadata).toMatchObject({
      path: '/project/missing.txt',
      startLine: 5,
      requestedLimit: 2,
    });
  });

  it('catches non-Error throws in readFile', async () => {
    (ctx.platform.fs.readFile as ReturnType<typeof vi.fn>).mockRejectedValue('string error');

    const result = await executor.execute(
      makeToolCall('file_read', { path: 'bad.txt' }),
      ctx,
    );

    expect(result.isError).toBe(true);
    expect(result.output).toContain('string error');
    expect(result.metadata).toMatchObject({ path: '/project/bad.txt' });
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
    expect(result.metadata).toMatchObject({
      path: '/project/output.txt',
      contentLength: 5,
    });
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

  it('returns error when path is blank before writing', async () => {
    const result = await executor.execute(
      makeToolCall('file_write', { path: '  \n\t  ', content: 'hello' }),
      ctx,
    );

    expect(result.isError).toBe(true);
    expect(result.output).toContain('"path" is required');
    expect(ctx.platform.fs.resolve).not.toHaveBeenCalled();
    expect(ctx.platform.fs.writeFile).not.toHaveBeenCalled();
  });

  it('uses the trimmed path before resolving the write target', async () => {
    (ctx.platform.fs.writeFile as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);

    await executor.execute(
      makeToolCall('file_write', { path: '  out/result.txt\n', content: 'hello' }),
      ctx,
    );

    expect(ctx.platform.fs.join).toHaveBeenCalledWith('/project', 'out/result.txt');
    expect(ctx.platform.fs.resolve).toHaveBeenCalledWith('/project/out/result.txt');
    expect(ctx.platform.fs.writeFile).toHaveBeenCalledWith('/project/out/result.txt', 'hello');
  });

  it('preserves absolute file_write paths instead of joining them to workingDir', async () => {
    (ctx.platform.fs.writeFile as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);

    await executor.execute(
      makeToolCall('file_write', { path: '/tmp/project/out.txt', content: 'hello' }),
      ctx,
    );

    expect(ctx.platform.fs.join).not.toHaveBeenCalled();
    expect(ctx.platform.fs.resolve).toHaveBeenCalledWith('/tmp/project/out.txt');
    expect(ctx.platform.fs.writeFile).toHaveBeenCalledWith('/tmp/project/out.txt', 'hello');
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

  it('returns error when content is not a string before writing', async () => {
    const result = await executor.execute(
      makeToolCall('file_write', { path: 'test.txt', content: 123 }),
      ctx,
    );

    expect(result.isError).toBe(true);
    expect(result.output).toContain('"content" is required');
    expect(ctx.platform.fs.writeFile).not.toHaveBeenCalled();
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
    expect(result.metadata).toMatchObject({
      path: '/project/test.txt',
      contentLength: 4,
    });
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
    expect(result.metadata).toMatchObject({
      path: '/project/code.ts',
      replaceAll: false,
      replacementCount: 1,
    });
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
    expect(result.metadata).toMatchObject({
      path: '/project/test.txt',
      replaceAll: true,
      replacementCount: 3,
    });
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
    expect(result.metadata).toMatchObject({ path: '/project/test.txt' });
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
    expect(result.metadata).toMatchObject({ path: '/project/test.txt' });
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

  it('returns error when path is blank before editing', async () => {
    const result = await executor.execute(
      makeToolCall('file_edit', {
        path: '  \n\t  ',
        old_string: 'a',
        new_string: 'b',
      }),
      ctx,
    );

    expect(result.isError).toBe(true);
    expect(result.output).toContain('"path" is required');
    expect(ctx.platform.fs.resolve).not.toHaveBeenCalled();
    expect(ctx.platform.fs.readFile).not.toHaveBeenCalled();
    expect(ctx.platform.fs.editFile).not.toHaveBeenCalled();
    expect(ctx.platform.fs.writeFile).not.toHaveBeenCalled();
  });

  it('uses the trimmed path before resolving the edit target', async () => {
    (ctx.platform.fs.readFile as ReturnType<typeof vi.fn>).mockResolvedValue('a');
    (ctx.platform.fs.editFile as ReturnType<typeof vi.fn>).mockResolvedValue(true);

    await executor.execute(
      makeToolCall('file_edit', {
        path: '  src/app.ts\n',
        old_string: 'a',
        new_string: 'b',
      }),
      ctx,
    );

    expect(ctx.platform.fs.join).toHaveBeenCalledWith('/project', 'src/app.ts');
    expect(ctx.platform.fs.resolve).toHaveBeenCalledWith('/project/src/app.ts');
    expect(ctx.platform.fs.readFile).toHaveBeenCalledWith('/project/src/app.ts');
    expect(ctx.platform.fs.editFile).toHaveBeenCalledWith('/project/src/app.ts', 'a', 'b');
  });

  it('preserves absolute file_edit paths instead of joining them to workingDir', async () => {
    (ctx.platform.fs.readFile as ReturnType<typeof vi.fn>).mockResolvedValue('a');
    (ctx.platform.fs.editFile as ReturnType<typeof vi.fn>).mockResolvedValue(true);

    await executor.execute(
      makeToolCall('file_edit', {
        path: '/tmp/project/app.ts',
        old_string: 'a',
        new_string: 'b',
      }),
      ctx,
    );

    expect(ctx.platform.fs.join).not.toHaveBeenCalled();
    expect(ctx.platform.fs.resolve).toHaveBeenCalledWith('/tmp/project/app.ts');
    expect(ctx.platform.fs.readFile).toHaveBeenCalledWith('/tmp/project/app.ts');
    expect(ctx.platform.fs.editFile).toHaveBeenCalledWith('/tmp/project/app.ts', 'a', 'b');
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

  it('returns error when new_string is not a string before file operations', async () => {
    const result = await executor.execute(
      makeToolCall('file_edit', {
        path: 'test.txt',
        old_string: 'a',
        new_string: 123,
      }),
      ctx,
    );

    expect(result.isError).toBe(true);
    expect(result.output).toContain('"new_string" is required');
    expect(ctx.platform.fs.readFile).not.toHaveBeenCalled();
    expect(ctx.platform.fs.editFile).not.toHaveBeenCalled();
    expect(ctx.platform.fs.writeFile).not.toHaveBeenCalled();
  });

  it('returns error when replace_all is not a boolean before file operations', async () => {
    const result = await executor.execute(
      makeToolCall('file_edit', {
        path: 'test.txt',
        old_string: 'a',
        new_string: 'b',
        replace_all: 'true',
      }),
      ctx,
    );

    expect(result.isError).toBe(true);
    expect(result.output).toContain('"replace_all" must be a boolean');
    expect(ctx.platform.fs.readFile).not.toHaveBeenCalled();
    expect(ctx.platform.fs.editFile).not.toHaveBeenCalled();
    expect(ctx.platform.fs.writeFile).not.toHaveBeenCalled();
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
    expect(result.metadata).toMatchObject({
      path: '/project/test.txt',
      replaceAll: false,
    });
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
    expect(result.metadata).toMatchObject({
      pattern: 'const x',
      path: '/project/.',
      ignoreCase: false,
      maxResults: 250,
      matchCount: 2,
    });
  });

  it('returns "No matches found" when results are empty', async () => {
    (ctx.platform.search.grep as ReturnType<typeof vi.fn>).mockResolvedValue([]);

    const result = await executor.execute(
      makeToolCall('grep', { pattern: 'nonexistent', path: '.' }),
      ctx,
    );

    expect(result.output).toBe('No matches found.');
    expect(result.metadata).toMatchObject({
      pattern: 'nonexistent',
      path: '/project/.',
      ignoreCase: false,
      maxResults: 250,
      matchCount: 0,
    });
  });

  it('returns error when pattern is missing', async () => {
    const result = await executor.execute(
      makeToolCall('grep', { path: '.' }),
      ctx,
    );

    expect(result.isError).toBe(true);
    expect(result.output).toContain('"pattern" is required');
  });

  it('returns error when pattern is blank before searching', async () => {
    const result = await executor.execute(
      makeToolCall('grep', { pattern: '  \n\t  ', path: '.' }),
      ctx,
    );

    expect(result.isError).toBe(true);
    expect(result.output).toContain('"pattern" is required');
    expect(ctx.platform.search.grep).not.toHaveBeenCalled();
  });

  it('uses the trimmed pattern before searching', async () => {
    const mockGrep = ctx.platform.search.grep as ReturnType<typeof vi.fn>;
    mockGrep.mockResolvedValue([]);

    await executor.execute(
      makeToolCall('grep', { pattern: '  TODO\n', path: 'src' }),
      ctx,
    );

    expect(mockGrep).toHaveBeenCalledWith(
      'TODO',
      ['/project/src'],
      expect.any(Object),
    );
  });

  it('returns error when path is missing', async () => {
    const result = await executor.execute(
      makeToolCall('grep', { pattern: 'test' }),
      ctx,
    );

    expect(result.isError).toBe(true);
    expect(result.output).toContain('"path" is required');
  });

  it('returns error when path is blank before searching', async () => {
    const result = await executor.execute(
      makeToolCall('grep', { pattern: 'test', path: '  \n\t  ' }),
      ctx,
    );

    expect(result.isError).toBe(true);
    expect(result.output).toContain('"path" is required');
    expect(ctx.platform.fs.resolve).not.toHaveBeenCalled();
    expect(ctx.platform.search.grep).not.toHaveBeenCalled();
  });

  it('uses the trimmed path before resolving the search target', async () => {
    const mockGrep = ctx.platform.search.grep as ReturnType<typeof vi.fn>;
    mockGrep.mockResolvedValue([]);

    await executor.execute(
      makeToolCall('grep', { pattern: 'test', path: '  src\n' }),
      ctx,
    );

    expect(ctx.platform.fs.join).toHaveBeenCalledWith('/project', 'src');
    expect(ctx.platform.fs.resolve).toHaveBeenCalledWith('/project/src');
    expect(mockGrep).toHaveBeenCalledWith(
      'test',
      ['/project/src'],
      expect.any(Object),
    );
  });

  it('preserves absolute grep paths instead of joining them to workingDir', async () => {
    const mockGrep = ctx.platform.search.grep as ReturnType<typeof vi.fn>;
    mockGrep.mockResolvedValue([]);

    await executor.execute(
      makeToolCall('grep', { pattern: 'test', path: '/tmp/project/src' }),
      ctx,
    );

    expect(ctx.platform.fs.join).not.toHaveBeenCalled();
    expect(ctx.platform.fs.resolve).toHaveBeenCalledWith('/tmp/project/src');
    expect(mockGrep).toHaveBeenCalledWith(
      'test',
      ['/tmp/project/src'],
      expect.any(Object),
    );
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

  it('passes trimmed include pattern to search.grep', async () => {
    const mockGrep = ctx.platform.search.grep as ReturnType<typeof vi.fn>;
    mockGrep.mockResolvedValue([]);

    await executor.execute(
      makeToolCall('grep', {
        pattern: 'TODO',
        path: 'src',
        include: '  *.ts\n',
      }),
      ctx,
    );

    expect(mockGrep).toHaveBeenCalledWith(
      'TODO',
      ['/project/src'],
      expect.objectContaining({ includePattern: '*.ts' }),
    );
  });

  it('omits include pattern when include is blank', async () => {
    const mockGrep = ctx.platform.search.grep as ReturnType<typeof vi.fn>;
    mockGrep.mockResolvedValue([]);

    await executor.execute(
      makeToolCall('grep', {
        pattern: 'TODO',
        path: 'src',
        include: '  \n\t  ',
      }),
      ctx,
    );

    expect(mockGrep).toHaveBeenCalledWith(
      'TODO',
      ['/project/src'],
      expect.objectContaining({ includePattern: undefined }),
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

  it('returns error for invalid max_results before searching', async () => {
    for (const max_results of [0, 1.5, Number.POSITIVE_INFINITY]) {
      const result = await executor.execute(
        makeToolCall('grep', { pattern: 'test', path: '.', max_results }),
        ctx,
      );

      expect(result.isError).toBe(true);
      expect(result.output).toContain('"max_results" must be a positive integer');
    }
    expect(ctx.platform.search.grep).not.toHaveBeenCalled();
  });

  it('returns error for invalid ignore_case before searching', async () => {
    const result = await executor.execute(
      makeToolCall('grep', { pattern: 'test', path: '.', ignore_case: 'true' }),
      ctx,
    );

    expect(result.isError).toBe(true);
    expect(result.output).toContain('"ignore_case" must be a boolean');
    expect(ctx.platform.search.grep).not.toHaveBeenCalled();
  });

  it('returns error for invalid include before searching', async () => {
    const result = await executor.execute(
      makeToolCall('grep', { pattern: 'test', path: '.', include: 123 }),
      ctx,
    );

    expect(result.isError).toBe(true);
    expect(result.output).toContain('"include" must be a string');
    expect(ctx.platform.search.grep).not.toHaveBeenCalled();
  });

  it('catches search.grep throws and returns error', async () => {
    (ctx.platform.search.grep as ReturnType<typeof vi.fn>).mockRejectedValue(
      new Error('regex invalid'),
    );

    const result = await executor.execute(
      makeToolCall('grep', { pattern: '[', path: 'src' }),
      ctx,
    );

    expect(result.isError).toBe(true);
    expect(result.output).toContain('regex invalid');
    expect(result.metadata).toMatchObject({
      pattern: '[',
      path: '/project/src',
    });
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
    expect(result.metadata).toMatchObject({
      pattern: '**/*.ts',
      path: '/project',
      fileCount: 2,
    });
  });

  it('returns "No files matched" when no results', async () => {
    (ctx.platform.search.glob as ReturnType<typeof vi.fn>).mockResolvedValue([]);

    const result = await executor.execute(
      makeToolCall('glob', { pattern: '*.xyz' }),
      ctx,
    );

    expect(result.output).toBe('No files matched the pattern.');
    expect(result.metadata).toMatchObject({
      pattern: '*.xyz',
      path: '/project',
      fileCount: 0,
    });
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

  it('returns error when pattern is blank before searching', async () => {
    const result = await executor.execute(
      makeToolCall('glob', { pattern: '  \n\t  ' }),
      ctx,
    );

    expect(result.isError).toBe(true);
    expect(result.output).toContain('"pattern" is required');
    expect(ctx.platform.search.glob).not.toHaveBeenCalled();
  });

  it('uses the trimmed pattern before searching', async () => {
    const mockGlob = ctx.platform.search.glob as ReturnType<typeof vi.fn>;
    mockGlob.mockResolvedValue([]);

    await executor.execute(
      makeToolCall('glob', { pattern: '  **/*.ts\n' }),
      ctx,
    );

    expect(mockGlob).toHaveBeenCalledWith('**/*.ts', '/project');
  });

  it('returns error for invalid path before searching', async () => {
    const mockGlob = ctx.platform.search.glob as ReturnType<typeof vi.fn>;

    const result = await executor.execute(
      makeToolCall('glob', { pattern: '*.ts', path: 123 }),
      ctx,
    );

    expect(result.isError).toBe(true);
    expect(result.output).toContain('"path" must be a string');
    expect(ctx.platform.fs.join).not.toHaveBeenCalled();
    expect(ctx.platform.fs.resolve).not.toHaveBeenCalled();
    expect(mockGlob).not.toHaveBeenCalled();
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

  it('uses workingDir as default search path when path is blank', async () => {
    const mockGlob = ctx.platform.search.glob as ReturnType<typeof vi.fn>;
    mockGlob.mockResolvedValue([]);

    await executor.execute(
      makeToolCall('glob', { pattern: '*.ts', path: '  \n\t  ' }),
      ctx,
    );

    expect(ctx.platform.fs.join).not.toHaveBeenCalled();
    expect(ctx.platform.fs.resolve).not.toHaveBeenCalled();
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

  it('preserves absolute glob paths instead of joining them to workingDir', async () => {
    const mockGlob = ctx.platform.search.glob as ReturnType<typeof vi.fn>;
    mockGlob.mockResolvedValue([]);

    await executor.execute(
      makeToolCall('glob', { pattern: '*.ts', path: '/tmp/project/src' }),
      ctx,
    );

    expect(ctx.platform.fs.join).not.toHaveBeenCalled();
    expect(ctx.platform.fs.resolve).toHaveBeenCalledWith('/tmp/project/src');
    expect(mockGlob).toHaveBeenCalledWith('*.ts', '/tmp/project/src');
  });

  it('catches search.glob throws and returns error', async () => {
    (ctx.platform.search.glob as ReturnType<typeof vi.fn>).mockRejectedValue(
      new Error('glob error'),
    );

    const result = await executor.execute(
      makeToolCall('glob', { pattern: '  *.ts\n', path: 'src' }),
      ctx,
    );

    expect(result.isError).toBe(true);
    expect(result.output).toContain('glob error');
    expect(result.metadata).toMatchObject({
      pattern: '*.ts',
      path: '/project/src',
    });
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
      'https://search.api/search?q=test+query',
      expect.objectContaining({ method: 'GET' }),
    );
  });

  it('formats successful output from normalized search results without raw provider payload fields', async () => {
    const mockData = {
      debugToken: 'provider-debug-token',
      results: [
        {
          title: 'Result Title',
          url: 'https://result.example',
          snippet: 'Result snippet',
          rawProviderField: 'raw-field-value',
        },
      ],
    };
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

    expect(result.output).toContain('Result Title');
    expect(result.output).toContain('https://result.example');
    expect(result.output).toContain('Result snippet');
    expect(result.output).not.toContain('provider-debug-token');
    expect(result.output).not.toContain('raw-field-value');
    expect(result.metadata.searchResults).toEqual([
      {
        title: 'Result Title',
        url: 'https://result.example',
        snippet: 'Result snippet',
      },
    ]);
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

  it('returns error when query is blank before searching', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ results: [] }),
    });
    globalThis.fetch = fetchMock;

    const executor = new WebSearchExecutor('https://search.api/search');
    const ctx = makeContext();

    const result = await executor.execute(
      makeToolCall('web_search', { query: '   \n\t  ' }),
      ctx,
    );

    expect(result.isError).toBe(true);
    expect(result.output).toContain('"query" is required');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('uses the trimmed query for custom search and metadata', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ results: [{ title: 'Hit', url: 'https://hit.example' }] }),
    });
    globalThis.fetch = fetchMock;

    const executor = new WebSearchExecutor('https://search.api/search');
    const ctx = makeContext();

    const result = await executor.execute(
      makeToolCall('web_search', { query: ' \nhello world\t ' }),
      ctx,
    );

    expect(result.isError).toBeUndefined();
    expect(fetchMock).toHaveBeenCalledWith(
      'https://search.api/search?q=hello+world',
      expect.objectContaining({ method: 'GET' }),
    );
    expect(result.metadata).toMatchObject({
      provider: 'custom',
      query: 'hello world',
      maxResults: 10,
    });
  });

  it('returns error for invalid max_results before searching', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ results: [] }),
    });
    globalThis.fetch = fetchMock;

    const executor = new WebSearchExecutor('https://search.api/search');
    const ctx = makeContext();

    const result = await executor.execute(
      makeToolCall('web_search', { query: 'test', max_results: '3' }),
      ctx,
    );

    expect(result.isError).toBe(true);
    expect(result.output).toContain('"max_results" must be a number');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('returns error for non-positive, fractional, or non-finite max_results before searching', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ results: [] }),
    });
    globalThis.fetch = fetchMock;

    const executor = new WebSearchExecutor('https://search.api/search');
    const ctx = makeContext();

    for (const max_results of [0, -1, 1.5, Number.POSITIVE_INFINITY]) {
      const result = await executor.execute(
        makeToolCall('web_search', { query: 'test', max_results }),
        ctx,
      );

      expect(result.isError).toBe(true);
      expect(result.output).toContain('"max_results" must be a positive integer');
    }
    expect(fetchMock).not.toHaveBeenCalled();
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
    expect(result.metadata).toMatchObject({ query: 'test' });
  });

  it('catches non-ok HTTP responses', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      statusText: 'Server Error',
    });

    const executor = new WebSearchExecutor('https://search.api/search');
    const ctx = makeContext();

    const result = await executor.execute(
      makeToolCall('web_search', { query: 'test' }),
      ctx,
    );

    expect(result.isError).toBe(true);
    expect(result.output).toContain('Search API returned 500');
    expect(result.metadata).toMatchObject({
      provider: 'custom',
      query: 'test',
      maxResults: 10,
      status: 500,
      statusText: 'Server Error',
    });
  });

  it('rejects non-http custom endpoints before calling fetch', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ results: [] }),
    });
    globalThis.fetch = fetchMock;

    const executor = new WebSearchExecutor('file:///tmp/search.json');
    const ctx = makeContext();

    const result = await executor.execute(
      makeToolCall('web_search', { query: 'local' }),
      ctx,
    );

    expect(result.isError).toBe(true);
    expect(result.output).toContain('http:// or https://');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('rejects non-http custom endpoints before calling platform.http', async () => {
    const http = { request: vi.fn().mockResolvedValue({ ok: true }) };
    const executor = new WebSearchExecutor('ftp://search.example/query');
    const ctx = makeContext({ http } as any);

    const result = await executor.execute(
      makeToolCall('web_search', { query: 'ftp' }),
      ctx,
    );

    expect(result.isError).toBe(true);
    expect(result.output).toContain('http:// or https://');
    expect(http.request).not.toHaveBeenCalled();
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

  it('extracts nested Bing-style webPages.value results', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        webPages: {
          value: [
            { name: 'Nested Result', url: 'https://nested.example', snippet: 'Nested snippet' },
          ],
        },
      }),
    });

    const executor = new WebSearchExecutor('https://search.api/search');
    const ctx = makeContext();

    const result = await executor.execute(
      makeToolCall('web_search', { query: 'nested' }),
      ctx,
    );

    expect(result.isError).toBeUndefined();
    expect(result.metadata.searchResults).toEqual([
      {
        title: 'Nested Result',
        url: 'https://nested.example',
        snippet: 'Nested snippet',
      },
    ]);
  });

  it('extracts nested Brave-style web.results entries', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        web: {
          results: [
            { title: 'Brave Result', url: 'https://brave.example', description: 'Brave description' },
          ],
        },
      }),
    });

    const executor = new WebSearchExecutor('https://search.api/search');
    const ctx = makeContext();

    const result = await executor.execute(
      makeToolCall('web_search', { query: 'brave' }),
      ctx,
    );

    expect(result.isError).toBeUndefined();
    expect(result.metadata.searchResults).toEqual([
      {
        title: 'Brave Result',
        url: 'https://brave.example',
        snippet: 'Brave description',
      },
    ]);
  });

  it('extracts top-level data array search results', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        data: [
          { title: 'Data Result', link: 'https://data.example', body: 'Data body' },
        ],
      }),
    });

    const executor = new WebSearchExecutor('https://search.api/search');
    const ctx = makeContext();

    const result = await executor.execute(
      makeToolCall('web_search', { query: 'data' }),
      ctx,
    );

    expect(result.isError).toBeUndefined();
    expect(result.metadata.searchResults).toEqual([
      {
        title: 'Data Result',
        url: 'https://data.example',
        snippet: 'Data body',
      },
    ]);
  });

  it('extracts response.results wrapped search results', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        response: {
          results: [
            { title: 'Wrapped Result', href: 'https://wrapped.example', summary: 'Wrapped summary' },
          ],
        },
      }),
    });

    const executor = new WebSearchExecutor('https://search.api/search');
    const ctx = makeContext();

    const result = await executor.execute(
      makeToolCall('web_search', { query: 'wrapped' }),
      ctx,
    );

    expect(result.isError).toBeUndefined();
    expect(result.metadata.searchResults).toEqual([
      {
        title: 'Wrapped Result',
        url: 'https://wrapped.example',
        snippet: 'Wrapped summary',
      },
    ]);
  });

  // ── Tavily provider mode ──
  it('calls Tavily API with Bearer auth and POST body', async () => {
    const mockData = {
      results: [
        { title: 'Tavily Hit', url: 'https://t.example', content: 'snippet text' },
        { title: 'Second Hit', url: 'https://second.example', content: 'second snippet' },
        { title: 'Third Hit', url: 'https://third.example', content: 'third snippet' },
        { title: 'Fourth Hit', url: 'https://fourth.example', content: 'fourth snippet' },
      ],
      answer: 'summary',
    };
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockData),
    });
    globalThis.fetch = fetchMock as any;

    const executor = new WebSearchExecutor({ provider: 'tavily', apiKey: 'tvly-test' });
    const ctx = makeContext();

    const result = await executor.execute(
      makeToolCall('web_search', { query: ' \nhello\t ', max_results: 3 }),
      ctx,
    );

    // POST to Tavily endpoint with Bearer auth + JSON body
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('https://api.tavily.com/search');
    expect(init.method).toBe('POST');
    expect(init.headers.Authorization).toBe('Bearer tvly-test');
    expect(init.headers['Content-Type']).toBe('application/json');
    const body = JSON.parse(init.body);
    expect(body.query).toBe('hello');
    expect(body.max_results).toBe(3);

    // Result maps Tavily `content` field → snippet
    expect(result.isError).toBeUndefined();
    expect(result.metadata).toMatchObject({
      provider: 'tavily',
      query: 'hello',
      maxResults: 3,
      resultCount: 3,
    });
    expect(result.metadata.searchResults).toHaveLength(3);
    expect(result.metadata.searchResults[0]).toMatchObject({
      title: 'Tavily Hit',
      url: 'https://t.example',
      snippet: 'snippet text',
    });
  });

  it('returns error when Tavily apiKey missing', async () => {
    const executor = new WebSearchExecutor({ provider: 'tavily' });
    const ctx = makeContext();
    const result = await executor.execute(
      makeToolCall('web_search', { query: 'x' }),
      ctx,
    );
    expect(result.isError).toBe(true);
    expect(result.output).toContain('Tavily API key');
  });

  // ── createWebSearchExecutor factory ──
  it('createWebSearchExecutor returns null when nothing configured', () => {
    expect(createWebSearchExecutor(null, null)).toBeNull();
    expect(createWebSearchExecutor(undefined, undefined)).toBeNull();
    expect(createWebSearchExecutor({}, null)).toBeNull();
  });

  it('createWebSearchExecutor prefers config over legacy endpoint', () => {
    const cfg: WebSearchConfig = { provider: 'tavily', apiKey: 'tvly-x' };
    const exec = createWebSearchExecutor(cfg, 'https://legacy/search');
    expect(exec).toBeInstanceOf(WebSearchExecutor);
  });

  it('createWebSearchExecutor falls back to legacy endpoint string', () => {
    const exec = createWebSearchExecutor(null, 'https://searxng/search');
    expect(exec).toBeInstanceOf(WebSearchExecutor);
  });

  // ── legacy string endpoint (backward compat) ──
  it('accepts a legacy endpoint string in constructor', async () => {
    const mockData = { results: [{ title: 'SearXNG', url: 'https://s.example' }] };
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockData),
    });

    const executor = new WebSearchExecutor('https://searxng/search');
    await executor.execute(makeToolCall('web_search', { query: 'q' }), makeContext());

    expect(globalThis.fetch).toHaveBeenCalledWith('https://searxng/search?q=q', expect.objectContaining({ method: 'GET' }));
  });

  it('adds q to custom endpoints that already have query parameters', async () => {
    const mockData = { results: [{ title: 'SearXNG', url: 'https://s.example' }] };
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockData),
    });

    const executor = new WebSearchExecutor('https://searxng/search?format=json');
    await executor.execute(makeToolCall('web_search', { query: 'hello world' }), makeContext());

    expect(globalThis.fetch).toHaveBeenCalledWith(
      'https://searxng/search?format=json&q=hello+world',
      expect.objectContaining({ method: 'GET' }),
    );
  });
});

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
      url: 'https://example.com/',
      contentType: 'text/html; charset=utf-8',
      status: 200,
    });
  });

  it('returns markdown when markdown format is requested for HTML', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      headers: {
        get: (name: string) => {
          if (name === 'content-type') return 'text/html';
          return null;
        },
      },
      text: () => Promise.resolve('<h1>Hello</h1><p>Read <a href="https://example.com/docs">docs</a>.</p>'),
    });

    const executor = new WebFetchExecutor();
    const ctx = makeContext();

    const result = await executor.execute(
      makeToolCall('web_fetch', { url: 'https://example.com', format: 'markdown' }),
      ctx,
    );

    expect(result.isError).toBeUndefined();
    expect(result.output).toContain('# Hello');
    expect(result.output).toContain('[docs](https://example.com/docs)');
    expect(result.output).not.toContain('<h1>');
    expect(result.output).not.toContain('<a href=');
  });

  it('uses the trimmed format before fetching and formatting output', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      headers: {
        get: (name: string) => {
          if (name === 'content-type') return 'text/html';
          return null;
        },
      },
      text: () => Promise.resolve('<h1>Hello</h1>'),
    });

    const executor = new WebFetchExecutor();
    const ctx = makeContext();

    const result = await executor.execute(
      makeToolCall('web_fetch', { url: 'https://example.com', format: ' markdown\n' }),
      ctx,
    );

    expect(result.isError).toBeUndefined();
    expect(result.output).toContain('# Hello');
    expect(globalThis.fetch).toHaveBeenCalled();
  });

  it('returns response body as text when content type is missing', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      headers: {
        get: () => null,
      },
      text: () => Promise.resolve('plain body without content type'),
    });

    const executor = new WebFetchExecutor();
    const ctx = makeContext();

    const result = await executor.execute(
      makeToolCall('web_fetch', { url: 'https://example.com/plain' }),
      ctx,
    );

    expect(result.isError).toBeUndefined();
    expect(result.output).toBe('plain body without content type');
    expect(result.output).not.toContain('Binary content');
  });

  it('treats content type media values case-insensitively', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      headers: {
        get: (name: string) => {
          if (name === 'content-type') return 'TEXT/HTML; charset=utf-8';
          return null;
        },
      },
      text: () => Promise.resolve('<h1>Mixed Case</h1>'),
    });

    const executor = new WebFetchExecutor();
    const ctx = makeContext();

    const result = await executor.execute(
      makeToolCall('web_fetch', { url: 'https://example.com/mixed-case' }),
      ctx,
    );

    expect(result.isError).toBeUndefined();
    expect(result.output).toBe('<h1>Mixed Case</h1>');
    expect(result.output).not.toContain('Binary content');
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

  it('uses the normalized URL after validation when fetching', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      headers: { get: () => 'text/plain' },
      text: () => Promise.resolve('body'),
    });
    globalThis.fetch = fetchMock;

    const executor = new WebFetchExecutor();
    const ctx = makeContext();

    const result = await executor.execute(
      makeToolCall('web_fetch', { url: ' \nhttps://example.com\t ' }),
      ctx,
    );

    expect(result.isError).toBeUndefined();
    expect(fetchMock).toHaveBeenCalledWith(
      'https://example.com/',
      expect.objectContaining({ method: 'GET' }),
    );
    expect(result.metadata).toMatchObject({ url: 'https://example.com/' });
  });

  it('returns error for invalid format before fetching', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      headers: { get: () => 'text/plain' },
      text: () => Promise.resolve('body'),
    });
    globalThis.fetch = fetchMock;

    const executor = new WebFetchExecutor();
    const ctx = makeContext();

    const result = await executor.execute(
      makeToolCall('web_fetch', { url: 'https://example.com', format: 'html' }),
      ctx,
    );

    expect(result.isError).toBe(true);
    expect(result.output).toContain('"format" must be "text" or "markdown"');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('rejects non-http URLs before calling fetch', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      headers: { get: () => null },
      text: () => Promise.resolve('local file'),
    });
    globalThis.fetch = fetchMock;

    const executor = new WebFetchExecutor();
    const ctx = makeContext();

    const fileResult = await executor.execute(
      makeToolCall('web_fetch', { url: 'file:///etc/passwd' }),
      ctx,
    );
    const ftpResult = await executor.execute(
      makeToolCall('web_fetch', { url: 'ftp://example.com/data' }),
      ctx,
    );

    expect(fileResult.isError).toBe(true);
    expect(fileResult.output).toContain('http:// or https://');
    expect(ftpResult.isError).toBe(true);
    expect(ftpResult.output).toContain('http:// or https://');
    expect(fetchMock).not.toHaveBeenCalled();
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
    expect(result.metadata).toMatchObject({ url: 'https://example.com/' });
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
    expect(result.output).toContain('Saved 23 characters');
    expect(result.output).not.toContain('User prefers TypeScript');
    expect(result.metadata).toMatchObject({ category: 'general', contentLength: 23 });
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

  it('passes trimmed custom category to saveAutoMemory', async () => {
    const mockManager = {
      saveAutoMemory: vi.fn().mockResolvedValue(undefined),
    };

    const executor = new MemorySaveExecutor(mockManager as any);
    const ctx = makeContext();

    await executor.execute(
      makeToolCall('memory_save', { content: 'some fact', category: '  preferences\n' }),
      ctx,
    );

    expect(mockManager.saveAutoMemory).toHaveBeenCalledWith('some fact', 'preferences');
  });

  it('uses default category when category is blank', async () => {
    const mockManager = {
      saveAutoMemory: vi.fn().mockResolvedValue(undefined),
    };

    const executor = new MemorySaveExecutor(mockManager as any);
    const ctx = makeContext();

    await executor.execute(
      makeToolCall('memory_save', { content: 'some fact', category: '  \n\t  ' }),
      ctx,
    );

    expect(mockManager.saveAutoMemory).toHaveBeenCalledWith('some fact', 'general');
  });

  it('returns error when category is not a string', async () => {
    const mockManager = { saveAutoMemory: vi.fn() };
    const executor = new MemorySaveExecutor(mockManager as any);
    const ctx = makeContext();

    const result = await executor.execute(
      makeToolCall('memory_save', { content: 'some fact', category: 42 }),
      ctx,
    );

    expect(result.isError).toBe(true);
    expect(result.output).toContain('"category" must be a string');
    expect(mockManager.saveAutoMemory).not.toHaveBeenCalled();
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

  it('returns error when content is blank before saving', async () => {
    const mockManager = { saveAutoMemory: vi.fn() };
    const executor = new MemorySaveExecutor(mockManager as any);
    const ctx = makeContext();

    const result = await executor.execute(
      makeToolCall('memory_save', { content: '  \n\t  ' }),
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
    expect(result.metadata).toMatchObject({
      category: 'general',
      contentLength: 4,
    });
  });

  it('trims content without echoing long content in output', async () => {
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
    expect(result.output).not.toContain('a'.repeat(80));
    expect(result.metadata).toMatchObject({ category: 'general', contentLength: 100 });
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

  it('filters memories by trimmed keyword', async () => {
    const mockManager = {
      getAllMemoryText: vi.fn().mockReturnValue(
        '- User prefers TypeScript\n- Project uses pnpm\n- User likes dark mode',
      ),
    };

    const executor = new MemoryRecallExecutor(mockManager as any);
    const ctx = makeContext();

    const result = await executor.execute(
      makeToolCall('memory_recall', { keyword: '  typescript\n' }),
      ctx,
    );

    expect(result.output).toContain('User prefers TypeScript');
    expect(result.output).not.toContain('pnpm');
  });

  it('filters memories by query alias', async () => {
    const mockManager = {
      getAllMemoryText: vi.fn().mockReturnValue(
        '- User prefers TypeScript\n- Project uses pnpm\n- User likes dark mode',
      ),
    };

    const executor = new MemoryRecallExecutor(mockManager as any);
    const ctx = makeContext();

    const result = await executor.execute(
      makeToolCall('memory_recall', { query: 'typescript' }),
      ctx,
    );

    expect(result.output).toContain('User prefers TypeScript');
    expect(result.output).not.toContain('pnpm');
  });

  it('returns error when keyword is not a string', async () => {
    const mockManager = {
      getAllMemoryText: vi.fn().mockReturnValue('- secret memory'),
    };

    const executor = new MemoryRecallExecutor(mockManager as any);
    const ctx = makeContext();

    const result = await executor.execute(
      makeToolCall('memory_recall', { keyword: 42 }),
      ctx,
    );

    expect(result.isError).toBe(true);
    expect(result.output).toContain('"keyword" must be a string');
    expect(mockManager.getAllMemoryText).not.toHaveBeenCalled();
  });

  it('returns error when query alias is not a string', async () => {
    const mockManager = {
      getAllMemoryText: vi.fn().mockReturnValue('- secret memory'),
    };

    const executor = new MemoryRecallExecutor(mockManager as any);
    const ctx = makeContext();

    const result = await executor.execute(
      makeToolCall('memory_recall', { query: 42 }),
      ctx,
    );

    expect(result.isError).toBe(true);
    expect(result.output).toContain('"query" must be a string');
    expect(mockManager.getAllMemoryText).not.toHaveBeenCalled();
  });

  it('returns error when keyword is blank before reading memory', async () => {
    const mockManager = {
      getAllMemoryText: vi.fn().mockReturnValue('- secret memory'),
    };

    const executor = new MemoryRecallExecutor(mockManager as any);
    const ctx = makeContext();

    const result = await executor.execute(
      makeToolCall('memory_recall', { keyword: '  \n\t  ' }),
      ctx,
    );

    expect(result.isError).toBe(true);
    expect(result.output).toContain('"keyword" must be a non-empty string');
    expect(mockManager.getAllMemoryText).not.toHaveBeenCalled();
  });

  it('returns error when query alias is blank before reading memory', async () => {
    const mockManager = {
      getAllMemoryText: vi.fn().mockReturnValue('- secret memory'),
    };

    const executor = new MemoryRecallExecutor(mockManager as any);
    const ctx = makeContext();

    const result = await executor.execute(
      makeToolCall('memory_recall', { query: '  \n\t  ' }),
      ctx,
    );

    expect(result.isError).toBe(true);
    expect(result.output).toContain('"query" must be a non-empty string');
    expect(mockManager.getAllMemoryText).not.toHaveBeenCalled();
  });

  it('rejects ambiguous keyword and query alias together', async () => {
    const mockManager = {
      getAllMemoryText: vi.fn().mockReturnValue('- secret memory'),
    };

    const executor = new MemoryRecallExecutor(mockManager as any);
    const ctx = makeContext();

    const result = await executor.execute(
      makeToolCall('memory_recall', { keyword: 'typescript', query: 'pnpm' }),
      ctx,
    );

    expect(result.isError).toBe(true);
    expect(result.output).toContain('use either "keyword" or "query"');
    expect(mockManager.getAllMemoryText).not.toHaveBeenCalled();
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
      makeToolCall('memory_recall', { query: '  TypeScript\n' }),
      ctx,
    );

    expect(result.isError).toBe(true);
    expect(result.output).toContain('read error');
    expect(result.metadata).toMatchObject({
      filterName: 'query',
      keyword: 'TypeScript',
    });
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

  it('returns error when a step title is not a string', async () => {
    const mockPM = makeMockPlanningManager();
    const executor = new PlanCreateExecutor(mockPM as any);

    const result = await executor.execute(
      makeToolCall('plan_create', {
        title: 'Plan',
        steps: [{ title: 123, description: 'First' }],
      }),
    );

    expect(result.isError).toBe(true);
    expect(result.output).toContain('"steps" must contain');
    expect(mockPM.createPlan).not.toHaveBeenCalled();
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
      getProgress: vi.fn((id: string) => {
        if (id !== 'plan_1') {
          return {
            total: 0,
            completed: 0,
            failed: 0,
            pending: 0,
            inProgress: 0,
            skipped: 0,
          };
        }
        return {
          total: plan.steps.length,
          completed: plan.steps.filter((s) => s.status === 'completed').length,
          failed: plan.steps.filter((s) => s.status === 'failed').length,
          pending: plan.steps.filter((s) => s.status === 'pending').length,
          inProgress: plan.steps.filter((s) => s.status === 'in_progress').length,
          skipped: plan.steps.filter((s) => s.status === 'skipped').length,
        };
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

  it('returns error when planId is not a string', async () => {
    const mockPM = makeMockPM();
    const executor = new PlanUpdateStepExecutor(mockPM as any);

    const result = await executor.execute(
      makeToolCall('plan_update_step', {
        planId: 42,
        stepId: 'step_1',
        status: 'completed',
      }),
    );

    expect(result.isError).toBe(true);
    expect(result.output).toContain('"planId" is required');
    expect(mockPM.getPlan).not.toHaveBeenCalled();
    expect(mockPM.updateStepStatus).not.toHaveBeenCalled();
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

  it('returns error when result is not a string', async () => {
    const mockPM = makeMockPM();
    const executor = new PlanUpdateStepExecutor(mockPM as any);

    const result = await executor.execute(
      makeToolCall('plan_update_step', {
        planId: 'plan_1',
        stepId: 'step_1',
        status: 'completed',
        result: 42,
      }),
    );

    expect(result.isError).toBe(true);
    expect(result.output).toContain('"result" must be a string');
    expect(mockPM.getPlan).not.toHaveBeenCalled();
    expect(mockPM.updateStepStatus).not.toHaveBeenCalled();
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
