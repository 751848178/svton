import { vi } from 'vitest';
import type { IPlatform } from '@svton/agent-platform';
import { DESKTOP_E2E_NATIVE_MARKER } from '@/lib/desktop-e2e-native.service';

export function makeDesktopE2ePlatform() {
  const writes = new Map<string, string>();
  const exec = vi.fn(async () => ({
    stdout: DESKTOP_E2E_NATIVE_MARKER,
    stderr: '',
    exitCode: 0,
    timedOut: false,
  }));
  const writeFile = vi.fn(
    async (path: string, content: string | Uint8Array) => {
      writes.set(path, String(content));
    },
  );
  const platform = {
    process: { exec },
    fs: { writeFile },
  } as unknown as IPlatform;
  return { platform, writes, exec, writeFile };
}
