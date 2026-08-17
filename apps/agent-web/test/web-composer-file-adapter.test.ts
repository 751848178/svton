import { describe, expect, it, vi } from 'vitest';
import { createTranslator, type Locale } from '@svton/ui';
import {
  createWebComposerFileAdapter,
  createWebFileAttachment,
} from '../src/components/web-composer-file-adapter';
import { createWebComposerFilePresentationCopy } from '../src/lib/locale/web-presentation-copy';

const copy = (locale: Locale) =>
  createWebComposerFilePresentationCopy(createTranslator(locale));

describe('web composer file identity', () => {
  it('keeps duplicate names distinct without inventing a browser path', () => {
    const file = { name: 'same.ts', size: 12, type: 'text/plain', lastModified: 1 };
    const first = createWebFileAttachment(file, 1);
    const second = createWebFileAttachment(file, 2);
    expect(first.name).toBe(second.name);
    expect(first.id).not.toBe(second.id);
    expect(first).not.toHaveProperty('path');
    expect(second).not.toHaveProperty('path');
  });

  it.each([
    ['en', 'The file handle is no longer available. Remove the attachment and select it again.'],
    ['zh', '文件句柄已失效，请移除后重新选择。'],
  ] as const)('returns the %s missing-handle result without changing identity data', async (locale, expected) => {
    const attachment = createWebFileAttachment({
      name: 'same.ts', size: 12, type: 'text/plain', lastModified: 1,
    }, 1);
    const result = await createWebComposerFileAdapter(copy(locale)).readText(attachment);
    expect(result).toEqual({ kind: 'failed', message: expected });
    expect(attachment).toMatchObject({
      id: 'web-file:1:12:1', name: 'same.ts', size: 12, mimeType: 'text/plain',
    });
  });

  it.each([
    ['en', 'The file could not be read. Check permissions and try again; the attachment was kept.'],
    ['zh', '文件读取失败，请检查权限后重试；附件已保留。'],
  ] as const)('returns the %s rejected-read result while retaining the selected file', async (locale, expected) => {
    const input = document.createElement('input');
    const file = new File(['content'], 'kept.ts', {
      type: 'text/plain', lastModified: 9,
    });
    const text = vi.fn().mockRejectedValue(new Error('denied'));
    Object.defineProperty(file, 'text', { value: text });
    Object.defineProperty(input, 'files', { value: [file] });
    vi.spyOn(document, 'createElement').mockReturnValue(input);
    vi.spyOn(input, 'click').mockImplementation(() => input.onchange?.(new Event('change')));
    const adapter = createWebComposerFileAdapter(copy(locale));
    const picked = await adapter.pick!();
    expect(picked.kind).toBe('selected');
    if (picked.kind !== 'selected') throw new Error('fixture did not select');
    const result = await adapter.readText(picked.attachment);
    expect(result).toEqual({ kind: 'failed', message: expected });
    expect(picked.attachment).toMatchObject({ name: 'kept.ts', mimeType: 'text/plain' });
    expect(text).toHaveBeenCalledOnce();
    vi.restoreAllMocks();
  });
});
