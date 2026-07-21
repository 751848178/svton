import { describe, expect, it, vi } from 'vitest';
import { PreviewDocumentExecutor } from '../src/tool/builtins/preview_document';
import type { ToolCall, ToolContext } from '../src/tool/types';
import { createMockPlatform } from './helpers';

function makeCall(args: Record<string, unknown>): ToolCall {
  return { id: 'preview-call', name: 'preview_document', arguments: args };
}

function makeCtx(previewResult: unknown): ToolContext {
  const platform = createMockPlatform({
    capabilities: { documentPreview: true },
  });
  (platform as any).preview = {
    previewPdf: vi.fn(async () => previewResult),
    previewExcel: vi.fn(),
    previewPptx: vi.fn(),
  };
  return { platform, sessionId: 's', workingDir: '/' };
}

function makeThrowingCtx(): ToolContext {
  const platform = createMockPlatform({
    capabilities: { documentPreview: true },
  });
  (platform as any).preview = {
    previewPdf: vi.fn(async () => {
      throw { code: 'provider_down' };
    }),
    previewExcel: vi.fn(),
    previewPptx: vi.fn(),
  };
  return { platform, sessionId: 's', workingDir: '/' };
}

function makeExcelCtx(previewResult: unknown): ToolContext {
  const platform = createMockPlatform({
    capabilities: { documentPreview: true },
  });
  (platform as any).preview = {
    previewPdf: vi.fn(),
    previewExcel: vi.fn(async () => previewResult),
    previewPptx: vi.fn(),
  };
  return { platform, sessionId: 's', workingDir: '/' };
}

function makePptxCtx(previewResult: unknown): ToolContext {
  const platform = createMockPlatform({
    capabilities: { documentPreview: true },
  });
  (platform as any).preview = {
    previewPdf: vi.fn(),
    previewExcel: vi.fn(),
    previewPptx: vi.fn(async () => previewResult),
  };
  return { platform, sessionId: 's', workingDir: '/' };
}

describe('preview_document result handling', () => {
  it.each([
    ['empty image array', []],
    ['blank image entry', ['page-1-base64', ' \n\t']],
  ])('rejects %s before returning preview JSON', async (_label, images) => {
    const result = await new PreviewDocumentExecutor().execute(
      makeCall({ path: '/doc.pdf', type: 'pdf' }),
      makeCtx({ kind: 'images', images }),
    );

    expect(result.isError).toBe(true);
    expect(result.output).toContain('Preview failed');
    expect(result.output).toContain('usable image data');
    expect(() => JSON.parse(result.output)).toThrow();
    expect(result.metadata).toMatchObject({
      path: '/doc.pdf',
      documentType: 'pdf',
      resultKind: 'images',
      imageCount: 0,
    });
  });

  it('normalizes non-Error provider failures before returning output', async () => {
    const result = await new PreviewDocumentExecutor().execute(
      makeCall({ path: '/doc.pdf', type: 'pdf' }),
      makeThrowingCtx(),
    );

    expect(result.isError).toBe(true);
    expect(result.output).toContain('Preview failed: Unknown error');
    expect(result.output).not.toContain('[object Object]');
    expect(result.metadata).toMatchObject({
      path: '/doc.pdf',
      documentType: 'pdf',
    });
  });

  it('rejects unserializable structured data before returning preview JSON', async () => {
    const result = await new PreviewDocumentExecutor().execute(
      makeCall({ path: '/sheet.xlsx', type: 'excel' }),
      makeExcelCtx({ kind: 'structured', data: undefined }),
    );

    expect(result.isError).toBe(true);
    expect(result.output).toContain('Preview failed');
    expect(result.output).toContain('structured data');
    expect(typeof result.output).toBe('string');
    expect(result.metadata).toMatchObject({
      path: '/sheet.xlsx',
      documentType: 'excel',
      resultKind: 'structured',
    });
  });

  it('rejects non-string text data before returning preview text', async () => {
    const result = await new PreviewDocumentExecutor().execute(
      makeCall({ path: '/deck.pptx', type: 'pptx' }),
      makePptxCtx({ kind: 'text', text: 123 }),
    );

    expect(result.isError).toBe(true);
    expect(result.output).toContain('Preview failed');
    expect(result.output).toContain('text data');
    expect(typeof result.output).toBe('string');
    expect(result.metadata).toMatchObject({
      path: '/deck.pptx',
      documentType: 'pptx',
      resultKind: 'text',
    });
  });
});
