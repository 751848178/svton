import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { IPlatform } from '@svton/agent-platform';
import { startDesktopE2eBootstrap } from '@/lib/desktop-e2e-bootstrap.service';
import { DESKTOP_E2E_RESULT_PATH } from '@/lib/desktop-e2e-evidence.service';

function makePlatform() {
  const writes: Array<{ path: string; content: string }> = [];
  const platform = {
    fs: {
      writeFile: vi.fn(async (path: string, content: string | Uint8Array) => {
        writes.push({ path, content: String(content) });
      }),
    },
  } as unknown as IPlatform;
  return { platform, writes };
}

describe('Desktop E2E bootstrap watchdog', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.stubEnv('VITE_SVTON_DESKTOP_E2E', '1');
    delete (window as any).__svtonDesktopE2e__;
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllEnvs();
  });

  it('immediately writes non-success bootstrap evidence', async () => {
    const { platform, writes } = makePlatform();
    const bootstrap = startDesktopE2eBootstrap(platform);
    await bootstrap.started;
    expect(JSON.parse(writes[0].content)).toMatchObject({
      state: 'running',
      ok: false,
      finalStatus: 'bootstrap',
    });
    expect(writes[0].path).toBe(DESKTOP_E2E_RESULT_PATH);
    bootstrap.dispose();
  });

  it('writes terminal failed evidence for initialization failure', async () => {
    const { platform, writes } = makePlatform();
    const bootstrap = startDesktopE2eBootstrap(platform);
    await bootstrap.started;
    await bootstrap.failInitialization('no_config');
    expect(JSON.parse(writes.at(-1)!.content)).toMatchObject({
      state: 'failed',
      finalStatus: 'initialization_failed',
      error: 'Desktop initialization did not reach ready (no_config)',
    });
  });

  it.each(['passed', 'failed'])(
    'does not overwrite an AutoDrive %s result',
    async (state) => {
      const { platform, writes } = makePlatform();
      const bootstrap = startDesktopE2eBootstrap(platform);
      await bootstrap.started;
      Object.assign(window, {
        __svtonDesktopE2e__: { state, finalStatus: 'idle' },
      });
      await vi.advanceTimersByTimeAsync(30_000);
      expect(writes).toHaveLength(1);
    },
  );

  it('writes watchdog failure when AutoDrive never reaches terminal', async () => {
    const { platform, writes } = makePlatform();
    const bootstrap = startDesktopE2eBootstrap(platform);
    await bootstrap.started;
    await vi.advanceTimersByTimeAsync(30_000);
    expect(JSON.parse(writes.at(-1)!.content)).toMatchObject({
      state: 'failed',
      finalStatus: 'bootstrap_timeout',
    });
  });

  it('is completely inert without the strict Vite flag', async () => {
    vi.stubEnv('VITE_SVTON_DESKTOP_E2E', '0');
    const { platform, writes } = makePlatform();
    const bootstrap = startDesktopE2eBootstrap(platform);
    await bootstrap.started;
    await vi.advanceTimersByTimeAsync(30_000);
    expect(writes).toHaveLength(0);
  });
});
