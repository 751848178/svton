import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useDesktopTimelineIntents } from '../src/components/use-desktop-timeline-intents';

const invoke = vi.fn();
vi.mock('@tauri-apps/api/core', () => ({ invoke }));

describe('desktop timeline intents', () => {
  beforeEach(() => invoke.mockReset().mockResolvedValue({
    path: '/Users/me/project/src/My File.tsx', line: null, column: null, lineFocusApplied: false,
  }));

  it('opens a typed path through the existing safe host reference route', async () => {
    const { result } = renderHook(() => useDesktopTimelineIntents(
      vi.fn(),
      '/Users/me/project',
    ));
    expect(result.current.timelineCapabilities).toMatchObject({ openPath: true });
    await act(async () => {
      await expect(result.current.onTimelineIntent({
        type: 'open', target: 'path', value: 'src/My File.tsx',
      })).resolves.toEqual({ status: 'handled', message: 'Opened /Users/me/project/src/My File.tsx' });
    });
    expect(invoke).toHaveBeenCalledWith('artifact_open_path', {
      path: 'src/My File.tsx',
      workingDir: '/Users/me/project',
      line: null,
      column: null,
    });
  });

  it.each(['reference', 'diff'] as const)(
    'rejects unsupported %s open intents without invoking the filesystem opener',
    async (target) => {
      const { result } = renderHook(() => useDesktopTimelineIntents(
        vi.fn(),
        '/Users/me/project',
      ));
      await act(async () => {
        await expect(result.current.onTimelineIntent({
          type: 'open', target, value: target === 'diff' ? '@@ diff' : 'reference-id',
        })).resolves.toEqual({
          status: 'unavailable',
          message: `Open ${target} unavailable in this host`,
        });
      });
      expect(invoke).not.toHaveBeenCalled();
    },
  );
});
