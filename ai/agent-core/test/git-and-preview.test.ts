/**
 * GitLogRange + PreviewDocument executor tests.
 *
 * Both already use platform abstractions (process.exec / platform.preview), so
 * no refactor was needed — these tests close the coverage gap.
 */
import { describe, it, expect, vi } from 'vitest';
import { exec as execShell } from 'node:child_process';
import { chmod, mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { GitLogRangeExecutor } from '../src/tool/builtins/git_review';
import { PreviewDocumentExecutor } from '../src/tool/builtins/preview_document';
import { createMockPlatform } from './helpers';
import type { ToolCall, ToolContext } from '../src/tool/types';
import type { ExecResult, SandboxProfile } from '@svton/agent-platform';

function makeCall(name: string, args: Record<string, unknown>): ToolCall {
  return { id: 'c1', name, arguments: args };
}

// ============================================================
// GitLogRangeExecutor
// ============================================================
describe('GitLogRangeExecutor', () => {
  function makeCtx(stdout: string, exitCode = 0): { ctx: ToolContext; exec: ReturnType<typeof vi.fn> } {
    let captured = '';
    const exec = vi.fn(async (cmd: string): Promise<ExecResult> => {
      captured = cmd;
      return { stdout, stderr: '', exitCode, timedOut: false };
    });
    const platform = createMockPlatform({
      process: { exec: exec as any },
      capabilities: { process: true },
    });
    return { ctx: { platform, sessionId: 's', workingDir: '/repo' }, exec };
  }

  it('builds git log with base..head range', async () => {
    const { ctx, exec } = makeCtx('abc123|Author|2024-01-01|Fix bug');
    const result = await new GitLogRangeExecutor().execute(
      makeCall('git_log_range', { base: 'main', head: 'feature' }),
      ctx,
    );
    expect(exec.mock.calls[0][0]).toContain('git log');
    expect(exec.mock.calls[0][0]).toContain('main..feature');
    expect(result.output).toContain('Fix bug');
    expect(result.isError).toBe(false);
  });

  it('defaults head to HEAD when only base given', async () => {
    const { ctx, exec } = makeCtx('commit');
    await new GitLogRangeExecutor().execute(
      makeCall('git_log_range', { base: 'develop' }),
      ctx,
    );
    expect(exec.mock.calls[0][0]).toContain('develop..HEAD');
  });

  it('quotes shell-sensitive git refs before executing log', async () => {
    const { ctx, exec } = makeCtx('commit');
    await new GitLogRangeExecutor().execute(
      makeCall('git_log_range', {
        base: "main' ; touch /tmp/pwn #",
        head: 'feature$(touch /tmp/pwn2)',
      }),
      ctx,
    );

    expect(exec.mock.calls[0][0]).toBe(
      "git log '--format=%H|%an|%ad|%s' --date=short -50 'main'\\'' ; touch /tmp/pwn #..feature$(touch /tmp/pwn2)'",
    );
  });

  it('preserves format separators when the command runs through a real shell', async () => {
    const root = await mkdtemp(join(tmpdir(), 'agent-git-log-format-'));
    try {
      const binDir = join(root, 'bin');
      await mkdir(binDir);
      const gitPath = join(binDir, 'git');
      await writeFile(gitPath, '#!/bin/sh\nprintf "%s\\n" "$@"\n');
      await chmod(gitPath, 0o755);

      const exec = vi.fn(async (cmd: string): Promise<ExecResult> => (
        new Promise((resolve) => {
          execShell(
            cmd,
            { cwd: root, env: { ...process.env, PATH: `${binDir}:${process.env.PATH ?? ''}` } },
            (error: any, stdout, stderr) => {
              resolve({
                stdout,
                stderr,
                exitCode: typeof error?.code === 'number' ? error.code : 0,
                timedOut: false,
              });
            },
          );
        })
      ));
      const platform = createMockPlatform({
        process: { exec: exec as any },
        capabilities: { process: true },
      });

      const result = await new GitLogRangeExecutor().execute(
        makeCall('git_log_range', { base: 'main', head: 'feature', limit: 1 }),
        { platform, sessionId: 's', workingDir: root },
      );

      expect(result.isError).toBe(false);
      expect(result.output).toContain('--format=%H|%an|%ad|%s');
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it('rejects blank git log refs before running git log', async () => {
    const { ctx, exec } = makeCtx('commit');
    const result = await new GitLogRangeExecutor().execute(
      makeCall('git_log_range', { base: ' \n\t ' }),
      ctx,
    );

    expect(result.isError).toBe(true);
    expect(result.output).toContain('invalid git ref');
    expect(exec).not.toHaveBeenCalled();
  });

  it('uses trimmed git refs when building the log command', async () => {
    const { ctx, exec } = makeCtx('commit');
    await new GitLogRangeExecutor().execute(
      makeCall('git_log_range', { base: ' \nmain\t ', head: ' feature\n' }),
      ctx,
    );

    expect(exec.mock.calls[0][0]).toContain('main..feature');
    expect(exec.mock.calls[0][0]).not.toContain("' \nmain\t ");
  });

  it('rejects git log refs that start with an option prefix', async () => {
    const { ctx, exec } = makeCtx('commit');
    const result = await new GitLogRangeExecutor().execute(
      makeCall('git_log_range', { base: '--output=/tmp/pwn' }),
      ctx,
    );

    expect(result.isError).toBe(true);
    expect(result.output).toContain('invalid git ref');
    expect(exec).not.toHaveBeenCalled();
  });

  it('rejects non-string git refs before running git log', async () => {
    const { ctx, exec } = makeCtx('commit');
    const result = await new GitLogRangeExecutor().execute(
      makeCall('git_log_range', { base: 'main', head: 123 }),
      ctx,
    );

    expect(result.isError).toBe(true);
    expect(result.output).toContain('invalid git ref');
    expect(exec).not.toHaveBeenCalled();
  });

  it('rejects head without base before running git log', async () => {
    const { ctx, exec } = makeCtx('commit');
    const result = await new GitLogRangeExecutor().execute(
      makeCall('git_log_range', { head: 'feature' }),
      ctx,
    );

    expect(result.isError).toBe(true);
    expect(result.output).toContain('"head" requires "base"');
    expect(exec).not.toHaveBeenCalled();
  });

  it('respects limit argument', async () => {
    const { ctx, exec } = makeCtx('c');
    await new GitLogRangeExecutor().execute(
      makeCall('git_log_range', { base: 'main', head: 'feat', limit: 10 }),
      ctx,
    );
    expect(exec.mock.calls[0][0]).toContain('-10');
  });

  it('defaults limit to 50', async () => {
    const { ctx, exec } = makeCtx('c');
    await new GitLogRangeExecutor().execute(
      makeCall('git_log_range', { base: 'main', head: 'feat' }),
      ctx,
    );
    expect(exec.mock.calls[0][0]).toContain('-50');
  });

  it.each([
    ['non-number', '10'],
    ['non-finite', Number.NaN],
    ['non-positive', 0],
    ['fractional', 1.5],
  ])('rejects %s limit before running git log', async (_label, limit) => {
    const { ctx, exec } = makeCtx('c');
    const result = await new GitLogRangeExecutor().execute(
      makeCall('git_log_range', { base: 'main', head: 'feat', limit }),
      ctx,
    );

    expect(result.isError).toBe(true);
    expect(result.output).toContain('"limit" must be a positive integer');
    expect(exec).not.toHaveBeenCalled();
  });

  it('uses sandbox exec when sandbox profile is available', async () => {
    const { ctx, exec } = makeCtx('process-log');
    const sandboxProfile: SandboxProfile = {
      mode: 'read_only',
      writablePaths: [],
      networkAccess: false,
    };
    const sandboxExec = vi.fn(async (): Promise<ExecResult> => ({
      stdout: 'sandbox-log',
      stderr: '',
      exitCode: 0,
      timedOut: false,
    }));
    (ctx.platform as any).sandbox = {
      createProfile: vi.fn(),
      exec: sandboxExec,
    };

    const result = await new GitLogRangeExecutor().execute(
      makeCall('git_log_range', { base: 'main', head: 'feat', limit: 3 }),
      { ...ctx, sandboxProfile },
    );

    expect(result.output).toContain('sandbox-log');
    expect(sandboxExec).toHaveBeenCalledWith(
      "git log '--format=%H|%an|%ad|%s' --date=short -3 main..feat",
      { cwd: '/repo', timeout: 15_000, signal: undefined },
      sandboxProfile,
    );
    expect(exec).not.toHaveBeenCalled();
  });

  it('fails closed when sandbox is required but the profile is absent', async () => {
    const { ctx, exec } = makeCtx('process-log');
    const sandboxExec = vi.fn();
    (ctx.platform as any).sandbox = {
      createProfile: vi.fn(),
      exec: sandboxExec,
    };

    const result = await new GitLogRangeExecutor().execute(
      makeCall('git_log_range', { base: 'main', head: 'feat', limit: 3 }),
      { ...ctx, sandboxRequired: true },
    );

  expect(result.isError).toBe(true);
  expect(result.output).toContain('requires sandbox execution');
  expect(result.metadata).toMatchObject({
    command: "git log '--format=%H|%an|%ad|%s' --date=short -3 main..feat",
  });
  expect(exec).not.toHaveBeenCalled();
  expect(sandboxExec).not.toHaveBeenCalled();
});

  it('returns isError=true when git log execution times out', async () => {
    const exec = vi.fn(async (): Promise<ExecResult> => ({
      stdout: '',
      stderr: '',
      exitCode: null,
      timedOut: true,
    }));
    const platform = createMockPlatform({
      process: { exec: exec as any },
      capabilities: { process: true },
    });

    const result = await new GitLogRangeExecutor().execute(
      makeCall('git_log_range', { base: 'main' }),
      { platform, sessionId: 's', workingDir: '/repo' },
    );

    expect(result.isError).toBe(true);
    expect(result.output).toContain('[timed out]');
    expect(result.metadata).toMatchObject({ exitCode: null });
  });

  it('preserves command metadata when git log execution throws', async () => {
    const exec = vi.fn(async (): Promise<ExecResult> => {
      throw new Error('spawn failed');
    });
    const platform = createMockPlatform({
      process: { exec: exec as any },
      capabilities: { process: true },
    });

    const result = await new GitLogRangeExecutor().execute(
      makeCall('git_log_range', { base: 'main', head: 'feat', limit: 3 }),
      { platform, sessionId: 's', workingDir: '/repo' },
    );

    expect(result.isError).toBe(true);
    expect(result.output).toContain('spawn failed');
    expect(result.metadata).toMatchObject({
      command: "git log '--format=%H|%an|%ad|%s' --date=short -3 main..feat",
    });
  });

  it('returns error when process.exec unavailable', async () => {
    // Build a platform whose process object has NO exec method (simulating
    // the browser environment where process capability is absent). The
    // executor checks `ctx.platform.process?.exec` — when exec is missing it
    // short-circuits to the "not available" error before calling.
    const platform: any = {
      type: 'browser',
      capabilities: { filesystem: false, process: false, watch: false, mcpStdio: false, clipboard: false, notification: false, sandboxing: false, pty: false, documentPreview: false, computerUse: false },
      fs: {},
      process: { getEnv: () => '', getCwd: () => '/' }, // no exec
      storage: { get: async () => null, set: async () => {}, delete: async () => {}, list: async () => [] },
      search: { grep: async () => [], glob: async () => [] },
    };
    const result = await new GitLogRangeExecutor().execute(
      makeCall('git_log_range', { base: 'main' }),
      { platform, sessionId: 's', workingDir: '/' },
    );
    expect(result.isError).toBe(true);
    expect(result.output).toContain('not available');
  });

  it('reports "(no commits in range)" for empty output', async () => {
    const { ctx } = makeCtx('   ');
    const result = await new GitLogRangeExecutor().execute(
      makeCall('git_log_range', { base: 'a', head: 'b' }),
      ctx,
    );
    expect(result.output).toContain('(no commits in range)');
  });
});

// ============================================================
// PreviewDocumentExecutor
// ============================================================
describe('PreviewDocumentExecutor', () => {
  function makeCtx(preview?: any): ToolContext {
    const platform = createMockPlatform({
      capabilities: { documentPreview: !!preview },
    });
    if (preview) (platform as any).preview = preview;
    return { platform, sessionId: 's', workingDir: '/' };
  }

  it('returns error when platform.preview is absent', async () => {
    const result = await new PreviewDocumentExecutor().execute(
      makeCall('preview_document', { path: '/x.pdf', type: 'pdf' }),
      makeCtx(undefined),
    );
    expect(result.isError).toBe(true);
    expect(result.output).toContain('not available');
  });

  it('previews PDF → images result', async () => {
    const preview = {
      previewPdf: vi.fn(async () => ({ kind: 'images' as const, images: ['p1', 'p2'] })),
      previewExcel: vi.fn(),
      previewPptx: vi.fn(),
    };
    const result = await new PreviewDocumentExecutor().execute(
      makeCall('preview_document', { path: '/doc.pdf', type: 'pdf' }),
      makeCtx(preview),
    );
    expect(preview.previewPdf).toHaveBeenCalledWith('/doc.pdf');
    const parsed = JSON.parse(result.output);
    expect(parsed.kind).toBe('images');
    expect(parsed.count).toBe(2);
    expect(result.metadata).toMatchObject({
      path: '/doc.pdf',
      documentType: 'pdf',
      resultKind: 'images',
      imageCount: 2,
    });
  });

  it('previews Excel → structured result', async () => {
    const preview = {
      previewPdf: vi.fn(),
      previewExcel: vi.fn(async () => ({ kind: 'structured' as const, data: { rows: 5 } })),
      previewPptx: vi.fn(),
    };
    const result = await new PreviewDocumentExecutor().execute(
      makeCall('preview_document', { path: '/x.xlsx', type: 'excel' }),
      makeCtx(preview),
    );
    expect(preview.previewExcel).toHaveBeenCalledWith('/x.xlsx');
    expect(result.output).toContain('"rows":5');
    expect(result.metadata).toMatchObject({
      path: '/x.xlsx',
      documentType: 'excel',
      resultKind: 'structured',
    });
  });

  it('previews PPTX → text result', async () => {
    const preview = {
      previewPdf: vi.fn(),
      previewExcel: vi.fn(),
      previewPptx: vi.fn(async () => ({ kind: 'text' as const, text: 'slide content' })),
    };
    const result = await new PreviewDocumentExecutor().execute(
      makeCall('preview_document', { path: '/x.pptx', type: 'pptx' }),
      makeCtx(preview),
    );
    expect(result.output).toBe('slide content');
    expect(result.metadata).toMatchObject({
      path: '/x.pptx',
      documentType: 'pptx',
      resultKind: 'text',
    });
  });

  it('rejects unknown document type', async () => {
    const preview = { previewPdf: vi.fn(), previewExcel: vi.fn(), previewPptx: vi.fn() };
    const result = await new PreviewDocumentExecutor().execute(
      makeCall('preview_document', { path: '/x', type: 'docx' }),
      makeCtx(preview),
    );
    expect(result.isError).toBe(true);
    expect(result.output).toContain('"type" must be one of');
  });

  it('rejects non-string preview path before rendering', async () => {
    const preview = { previewPdf: vi.fn(), previewExcel: vi.fn(), previewPptx: vi.fn() };
    const result = await new PreviewDocumentExecutor().execute(
      makeCall('preview_document', { path: 42, type: 'pdf' }),
      makeCtx(preview),
    );
    expect(result.isError).toBe(true);
    expect(result.output).toContain('"path" is required and must be a string');
    expect(preview.previewPdf).not.toHaveBeenCalled();
  });

  it('rejects blank preview path before rendering', async () => {
    const preview = { previewPdf: vi.fn(), previewExcel: vi.fn(), previewPptx: vi.fn() };
    const result = await new PreviewDocumentExecutor().execute(
      makeCall('preview_document', { path: ' \n\t ', type: 'pdf' }),
      makeCtx(preview),
    );
    expect(result.isError).toBe(true);
    expect(result.output).toContain('"path" is required and must be a string');
    expect(preview.previewPdf).not.toHaveBeenCalled();
  });

  it('rejects non-string preview type before rendering', async () => {
    const preview = { previewPdf: vi.fn(), previewExcel: vi.fn(), previewPptx: vi.fn() };
    const result = await new PreviewDocumentExecutor().execute(
      makeCall('preview_document', { path: '/x.pdf', type: 123 }),
      makeCtx(preview),
    );
    expect(result.isError).toBe(true);
    expect(result.output).toContain('"type" must be one of');
    expect(preview.previewPdf).not.toHaveBeenCalled();
    expect(preview.previewExcel).not.toHaveBeenCalled();
    expect(preview.previewPptx).not.toHaveBeenCalled();
  });

  it('uses trimmed preview path and type before rendering', async () => {
    const preview = {
      previewPdf: vi.fn(async () => ({ kind: 'images' as const, images: ['p1'] })),
      previewExcel: vi.fn(),
      previewPptx: vi.fn(),
    };
    const result = await new PreviewDocumentExecutor().execute(
      makeCall('preview_document', { path: ' \n/doc.pdf\t ', type: ' pdf\n' }),
      makeCtx(preview),
    );
    expect(result.isError).toBeUndefined();
    expect(preview.previewPdf).toHaveBeenCalledWith('/doc.pdf');
  });

  it('surfaces preview errors', async () => {
    const preview = {
      previewPdf: vi.fn(async () => { throw new Error('file corrupted'); }),
      previewExcel: vi.fn(),
      previewPptx: vi.fn(),
    };
    const result = await new PreviewDocumentExecutor().execute(
      makeCall('preview_document', { path: '/bad.pdf', type: 'pdf' }),
      makeCtx(preview),
    );
    expect(result.isError).toBe(true);
    expect(result.output).toContain('file corrupted');
    expect(result.metadata).toMatchObject({
      path: '/bad.pdf',
      documentType: 'pdf',
    });
  });
});
