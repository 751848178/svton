import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createTranslator, type Locale } from '@svton/ui';
import {
  createWebArtifactHostAdapter,
  resolveWebOpenCapability,
} from '../src/components/web-artifact-host-adapter';
import { createWebArtifactPresentationCopy } from '../src/lib/locale/web-presentation-copy';

const copy = (locale: Locale) =>
  createWebArtifactPresentationCopy(createTranslator(locale));
const reference = (path: string) => ({ kind: 'reference' as const, id: path, path });

describe.each([
  ['en', {
    downloaded: 'Downloaded the current draft: doc.md',
    blocked: 'The browser blocked the new window. Allow pop-ups and try again.',
    opened: 'Opened the link in a new tab.', failed: 'The link did not open. Try again.',
    file: 'The Web host cannot open local files directly.',
    path: 'The Web host cannot open local paths directly.',
    protocol: 'The Web host can open only http(s) links.',
  }],
  ['zh', {
    downloaded: '已下载当前草稿：doc.md',
    blocked: '浏览器阻止了新窗口，请允许弹窗后重试。',
    opened: '已在新标签页打开链接。', failed: '链接未打开，请重试。',
    file: 'Web 主机不能直接打开本地文件。', path: 'Web 主机不能直接打开本地路径。',
    protocol: 'Web 主机仅支持打开 http(s) 链接。',
  }],
] as const)('web artifact host adapter (%s)', (locale, expected) => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.stubGlobal('URL', Object.assign(URL, {
      createObjectURL: vi.fn(() => 'blob:artifact'), revokeObjectURL: vi.fn(),
    }));
  });

  it('allows only http(s) and gives all unsupported targets localized reasons', () => {
    const presentation = copy(locale);
    expect(resolveWebOpenCapability(reference('https://example.com'), presentation).supported).toBe(true);
    expect(resolveWebOpenCapability(reference('javascript:alert(1)'), presentation))
      .toEqual({ supported: false, reason: expected.protocol });
    expect(resolveWebOpenCapability(reference('/tmp/local.ts'), presentation))
      .toEqual({ supported: false, reason: expected.path });
    expect(resolveWebOpenCapability({
      kind: 'file', id: 'f', path: '/tmp/a', source: 'tree',
    }, presentation)).toEqual({ supported: false, reason: expected.file });
  });

  it('preserves blocked, successful, and thrown window-open outcomes', async () => {
    const adapter = createWebArtifactHostAdapter(copy(locale));
    vi.spyOn(window, 'open').mockReturnValueOnce(null);
    await expect(adapter.openReadonly(reference('https://example.com'))).resolves.toEqual({
      kind: 'failed', retryable: true, message: expected.blocked,
    });
    const opened = { opener: {} } as Window;
    vi.spyOn(window, 'open').mockReturnValueOnce(opened);
    await expect(adapter.openReadonly(reference('https://example.com'))).resolves.toEqual({
      kind: 'succeeded', message: expected.opened,
    });
    expect(opened.opener).toBeNull();
    vi.spyOn(window, 'open').mockImplementationOnce(() => { throw new Error('blocked'); });
    await expect(adapter.openReadonly(reference('https://example.com'))).resolves.toEqual({
      kind: 'failed', retryable: true, message: expected.failed,
    });
  });

  it('downloads the exact request content and filename with localized grammar', async () => {
    class CapturedBlob {
      constructor(
        readonly parts: BlobPart[],
        readonly options?: BlobPropertyBag,
      ) {}
      get type() { return this.options?.type ?? ''; }
    }
    vi.stubGlobal('Blob', CapturedBlob);
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined);
    const result = await createWebArtifactHostAdapter(copy(locale)).exportGenerated({
      targetId: 'doc', filename: 'doc.md', mimeType: 'text/markdown', content: 'current draft',
    });
    expect(result).toEqual({ kind: 'succeeded', message: expected.downloaded });
    expect(click).toHaveBeenCalledOnce();
    const blob = vi.mocked(URL.createObjectURL).mock.calls[0][0] as unknown as CapturedBlob;
    expect(blob.type).toBe('text/markdown');
    expect(blob.parts).toEqual(['current draft']);
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:artifact');
  });
});

describe('Web adapter fixed-sentence ownership', () => {
  it('keeps fixed presentation sentences out of all three adapters', () => {
    const root = resolve(process.cwd(), '../..');
    const files = [
      'apps/agent-web/src/lib/browser-settings-adapter.ts',
      'apps/agent-web/src/components/web-composer-file-adapter.ts',
      'apps/agent-web/src/components/web-artifact-host-adapter.ts',
    ];
    for (const file of files) {
      const source = readFileSync(resolve(root, file), 'utf8');
      expect(source, file).not.toMatch(/[一-龥]/u);
      expect(source, file).not.toMatch(/file handle is no longer|file could not be read|download did not complete|browser blocked the new window|opened the link|Web host cannot open/i);
      expect(source, file).not.toMatch(/useI18n|from ['"]react['"]/);
    }
    const browserAdapter = readFileSync(resolve(root, files[0]), 'utf8');
    expect(browserAdapter).not.toMatch(/from ['"]@\/components\//);
    const presentation = readFileSync(resolve(
      root, 'apps/agent-web/src/lib/locale/web-presentation-copy.ts',
    ), 'utf8');
    expect(presentation).not.toMatch(/useI18n|from ['"]react['"]|\b(?:window|document|localStorage)\b/);
  });
});
