/**
 * GitLogRange + PreviewDocument executor tests.
 *
 * Both already use platform abstractions (process.exec / platform.preview), so
 * no refactor was needed — these tests close the coverage gap.
 */
import { describe, it, expect, vi } from 'vitest';
import { GitLogRangeExecutor } from '../src/tool/builtins/git_review';
import { PreviewDocumentExecutor } from '../src/tool/builtins/preview_document';
import { createMockPlatform } from './helpers';
import type { ToolCall, ToolContext } from '../src/tool/types';
import type { ExecResult } from '@svton/agent-platform';

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
  });

  it('rejects unknown document type', async () => {
    const preview = { previewPdf: vi.fn(), previewExcel: vi.fn(), previewPptx: vi.fn() };
    const result = await new PreviewDocumentExecutor().execute(
      makeCall('preview_document', { path: '/x', type: 'docx' }),
      makeCtx(preview),
    );
    expect(result.isError).toBe(true);
    expect(result.output).toContain('Unknown document type');
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
  });
});
