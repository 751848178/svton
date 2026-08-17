import { describe, expect, it, vi } from 'vitest';
import { createDesktopArtifactHostAdapter, resolveDesktopOpenCapability } from '../src/components/desktop-artifact-host-adapter';

type Invoke = <T>(command: string, args?: Record<string, unknown>) => Promise<T>;

describe('desktop artifact host adapter', () => {
  it('preserves the window preview preference through the typed host contract', async () => {
    localStorage.setItem('agent:preview_mode', 'window');
    const invoke = vi.fn(async <T,>() => undefined as T);
    const result = await createDesktopArtifactHostAdapter('/workspace', invoke as unknown as Invoke).presentEditable?.({
      kind: 'document', id: 'doc', title: 'Preview', format: 'markdown', content: 'current',
    });
    expect(invoke).toHaveBeenCalledWith('popout_preview', { key: expect.any(String) });
    expect(result).toMatchObject({ kind: 'succeeded', message: expect.stringContaining('只读') });
    localStorage.removeItem('agent:preview_mode');
  });

  it('passes path, project directory, line, and column as typed invoke fields', async () => {
    const invoke = vi.fn(async <T,>(command: string) => (command === 'artifact_open_path'
      ? { path: '/workspace/a.ts', line: 8, column: 3, lineFocusApplied: false }
      : undefined) as T);
    const result = await createDesktopArtifactHostAdapter('/workspace', invoke as unknown as Invoke).openReadonly({
      kind: 'reference', id: 'ref', path: 'a.ts', line: 8, column: 3,
    });
    expect(invoke).toHaveBeenCalledWith('artifact_open_path', {
      path: 'a.ts', workingDir: '/workspace', line: 8, column: 3,
    });
    expect(result).toMatchObject({ kind: 'succeeded', message: expect.stringContaining('无法自动定位') });
    expect(invoke.mock.calls.flat().join(' ')).not.toContain('process_exec');
  });

  it('uses Save dialog cancellation as an explicit cancelled result', async () => {
    const invoke = vi.fn(async <T,>() => null as T);
    const result = await createDesktopArtifactHostAdapter('/workspace', invoke as unknown as Invoke).exportGenerated({
      targetId: 'doc', filename: 'doc.md', mimeType: 'text/markdown', content: 'current',
    });
    expect(result.kind).toBe('cancelled');
    expect(invoke).toHaveBeenCalledTimes(1);
  });

  it('writes current content only after the user chooses a path', async () => {
    const invoke = vi.fn(async <T,>(command: string) => (
      command === 'dialog_save_file' ? '/tmp/doc.md' : undefined
    ) as T);
    const result = await createDesktopArtifactHostAdapter('/workspace', invoke as unknown as Invoke).exportGenerated({
      targetId: 'doc', filename: 'doc.md', mimeType: 'text/markdown', content: 'edited draft',
    });
    expect(result.kind).toBe('succeeded');
    expect(invoke).toHaveBeenNthCalledWith(2, 'fs_write_file', {
      path: '/tmp/doc.md', content: 'edited draft', binary: false,
    });
  });

  it('rejects non-http URL schemes before invoking the native host', () => {
    expect(resolveDesktopOpenCapability({ kind: 'reference', id: 'x', path: 'file:///etc/passwd' })).toMatchObject({ supported: false });
    expect(resolveDesktopOpenCapability({ kind: 'reference', id: 'x', path: 'https://example.com' })).toMatchObject({ supported: true });
  });
});
