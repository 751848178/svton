import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createDesktopComposerFileAdapter } from '../src/components/desktop-composer-file-adapter';

const invoke = vi.fn();
vi.mock('@tauri-apps/api/core', () => ({ invoke }));

describe('desktop composer file adapter', () => {
  beforeEach(() => invoke.mockReset());

  it('preserves the real host path and reads only when the controller requests content', async () => {
    invoke
      .mockResolvedValueOnce('/workspace/src/same.ts')
      .mockResolvedValueOnce({ is_file: true, size: 12 })
      .mockResolvedValueOnce('export const value = 1;');
    const adapter = createDesktopComposerFileAdapter();

    const picked = await adapter.pick();
    expect(picked).toEqual({
      kind: 'selected',
      attachment: {
        id: 'file:/workspace/src/same.ts',
        kind: 'file',
        name: 'same.ts',
        path: '/workspace/src/same.ts',
        size: 12,
      },
    });
    expect(invoke).toHaveBeenCalledTimes(2);

    if (picked.kind !== 'selected') throw new Error('expected selected file');
    await expect(adapter.readText(picked.attachment)).resolves.toEqual({
      kind: 'succeeded', text: 'export const value = 1;',
    });
    expect(invoke).toHaveBeenLastCalledWith('fs_read_file', { path: '/workspace/src/same.ts' });
  });

  it('returns visible cancellation and read failures without a fake path', async () => {
    const adapter = createDesktopComposerFileAdapter();
    invoke.mockResolvedValueOnce(null);
    await expect(adapter.pick()).resolves.toEqual({ kind: 'cancelled' });
    await expect(adapter.readText({ id: 'opaque', kind: 'file', name: 'same.ts', size: 1 }))
      .resolves.toEqual({ kind: 'failed', message: '文件路径不可用，请移除后重新选择。' });
  });
});
