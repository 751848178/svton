import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { loadConfigMock } = vi.hoisted(() => ({
  loadConfigMock: vi.fn(),
}));

vi.mock('@/lib/config-store', () => ({
  loadConfig: loadConfigMock,
}));

import { loadDesktopAgentConfig } from '@/lib/desktop-agent-config.service';
import {
  DESKTOP_E2E_MARKER,
  DESKTOP_E2E_MODEL,
  desktopE2eActive,
  enqueueDesktopE2eResponse,
  waitForDesktopE2eResponse,
} from '@/lib/e2e-provider';
import {
  extractDesktopE2eMessageText,
  extractDesktopE2eText,
} from '@/lib/desktop-e2e-messages.utils';

describe('Desktop E2E provider seam', () => {
  beforeEach(() => {
    loadConfigMock.mockReset();
    delete (window as any).__SVTON_DESKTOP_E2E_QUEUE__;
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('activates only for the exact Vite flag value', () => {
    vi.stubEnv('VITE_SVTON_DESKTOP_E2E', '1');
    expect(desktopE2eActive()).toBe(true);
    vi.stubEnv('VITE_SVTON_DESKTOP_E2E', 'true');
    expect(desktopE2eActive()).toBe(false);
    vi.stubEnv('VITE_SVTON_DESKTOP_E2E', '0');
    expect(desktopE2eActive()).toBe(false);
  });

  it('bypasses loadConfig and forces the E2E model when active', async () => {
    vi.stubEnv('VITE_SVTON_DESKTOP_E2E', '1');
    const result = await loadDesktopAgentConfig({} as never);
    expect(loadConfigMock).not.toHaveBeenCalled();
    expect(result.config?.model.name).toBe(DESKTOP_E2E_MODEL);
  });

  it('uses loadConfig in normal runs', async () => {
    vi.stubEnv('VITE_SVTON_DESKTOP_E2E', '0');
    loadConfigMock.mockResolvedValue({ config: null });
    const platform = {} as never;
    await loadDesktopAgentConfig(platform);
    expect(loadConfigMock).toHaveBeenCalledWith(platform);
  });

  it('queues one deterministic response and bounds an empty queue', async () => {
    enqueueDesktopE2eResponse();
    const response = await waitForDesktopE2eResponse(50);
    expect(JSON.stringify(response)).toContain(DESKTOP_E2E_MARKER);
    await expect(waitForDesktopE2eResponse(1)).rejects.toThrow('timed out');
  });

  it('extracts string content and Pi text-block arrays', () => {
    expect(extractDesktopE2eText('plain text')).toBe('plain text');
    expect(extractDesktopE2eText([
      { type: 'thinking', text: 'hidden' },
      { type: 'text', text: 'first' },
      { type: 'text', text: ' second' },
    ])).toBe('first second');
    expect(extractDesktopE2eMessageText({
      content: '',
      blocks: [{ type: 'text', text: 'block fallback' }],
    })).toBe('block fallback');
  });
});
