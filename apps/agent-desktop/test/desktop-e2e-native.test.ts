import { beforeEach, describe, expect, it, vi } from 'vitest';
import { runDesktopE2eDrive } from '@/lib/desktop-e2e-drive.service';
import { DESKTOP_E2E_RESULT_PATH } from '@/lib/desktop-e2e-evidence.service';
import {
  DESKTOP_E2E_NATIVE_MARKER,
  DESKTOP_E2E_NATIVE_PATH,
  runDesktopE2eNativeProbe,
} from '@/lib/desktop-e2e-native.service';
import { DESKTOP_E2E_MODEL } from '@/lib/e2e-provider';
import { makeDesktopE2ePlatform } from './desktop-e2e-platform.fixture';

describe('Desktop E2E native evidence', () => {
  beforeEach(() => {
    delete (window as any).__SVTON_DESKTOP_E2E_QUEUE__;
    delete (window as any).__svtonDesktopE2e__;
    delete (window as any).__svtonDesktopE2eNative;
  });

  it('persists terminal process_exec and fs_write_file evidence', async () => {
    const { platform, writes, exec } = makeDesktopE2ePlatform();
    const evidence = await runDesktopE2eNativeProbe(platform);
    expect(exec).toHaveBeenCalledWith(
      `printf ${DESKTOP_E2E_NATIVE_MARKER}`,
      { timeout: 5_000 },
    );
    expect(evidence).toMatchObject({
      state: 'passed',
      ok: true,
      exitCode: 0,
      hasMarker: true,
    });
    expect(JSON.parse(writes.get(DESKTOP_E2E_NATIVE_PATH)!)).toMatchObject({
      command: 'process_exec',
      shellCommand: `printf ${DESKTOP_E2E_NATIVE_MARKER}`,
      stdout: DESKTOP_E2E_NATIVE_MARKER,
    });
  });

  it('keeps command proof in main result when native JSON writing fails', async () => {
    const { platform, writes, writeFile } = makeDesktopE2ePlatform();
    writeFile.mockImplementation(async (path, content) => {
      if (path === DESKTOP_E2E_NATIVE_PATH) throw new Error('native write denied');
      writes.set(path, String(content));
    });
    const evidence = await runDesktopE2eDrive({
      platform,
      getModel: () => DESKTOP_E2E_MODEL,
      getMessages: () => [],
      getStatus: () => 'idle',
      send: vi.fn(),
    }, { timeoutMs: 50, pollIntervalMs: 1 });

    expect(evidence).toMatchObject({
      state: 'failed',
      native: {
        state: 'failed',
        stdout: DESKTOP_E2E_NATIVE_MARKER,
        exitCode: 0,
        hasMarker: true,
        evidenceWriteError: 'native write denied',
      },
    });
    expect(JSON.parse(writes.get(DESKTOP_E2E_RESULT_PATH)!)).toMatchObject({
      native: {
        stdout: DESKTOP_E2E_NATIVE_MARKER,
        evidenceWriteError: 'native write denied',
      },
    });
  });
});
