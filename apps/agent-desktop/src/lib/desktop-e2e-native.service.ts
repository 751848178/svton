import type { IPlatform } from '@svton/agent-platform';

export const DESKTOP_E2E_NATIVE_PATH =
  '/tmp/svton-desktop-e2e-native.json';
export const DESKTOP_E2E_NATIVE_MARKER =
  'svton-tauri-native-boundary';

export interface DesktopE2eNativeEvidence {
  state: 'passed' | 'failed';
  ok: boolean;
  command: string;
  shellCommand: string;
  stdout: string;
  stderr: string;
  exitCode: number | null;
  timedOut: boolean;
  hasMarker: boolean;
  startedAt: number;
  completedAt: number;
  error?: string;
  evidenceWriteError?: string;
}

export async function runDesktopE2eNativeProbe(
  platform: IPlatform,
): Promise<DesktopE2eNativeEvidence> {
  const command = `printf ${DESKTOP_E2E_NATIVE_MARKER}`;
  const startedAt = Date.now();
  let evidence: DesktopE2eNativeEvidence;
  try {
    const result = await platform.process.exec(command, { timeout: 5_000 });
    const hasMarker = result.stdout.includes(DESKTOP_E2E_NATIVE_MARKER);
    const ok = result.exitCode === 0 && !result.timedOut && hasMarker;
    evidence = {
      state: ok ? 'passed' : 'failed',
      ok,
      command: 'process_exec',
      shellCommand: command,
      stdout: result.stdout,
      stderr: result.stderr,
      exitCode: result.exitCode,
      timedOut: result.timedOut,
      hasMarker,
      startedAt,
      completedAt: Date.now(),
      ...(ok ? {} : { error: describeFailure(result, hasMarker) }),
    };
  } catch (error) {
    evidence = {
      state: 'failed',
      ok: false,
      command: 'process_exec',
      shellCommand: command,
      stdout: '',
      stderr: '',
      exitCode: null,
      timedOut: false,
      hasMarker: false,
      startedAt,
      completedAt: Date.now(),
      error: errorText(error),
    };
  }
  if (typeof window !== 'undefined') {
    Object.assign(window, { __svtonDesktopE2eNative: evidence });
  }
  try {
    await platform.fs.writeFile(
      DESKTOP_E2E_NATIVE_PATH,
      JSON.stringify(evidence),
    );
  } catch (writeError) {
    const evidenceWriteError = errorText(writeError);
    evidence = {
      ...evidence,
      state: 'failed',
      ok: false,
      error: evidence.error || `fs_write_file failed: ${evidenceWriteError}`,
      evidenceWriteError,
    };
    if (typeof window !== 'undefined') {
      Object.assign(window, { __svtonDesktopE2eNative: evidence });
    }
  }
  return evidence;
}

function describeFailure(
  result: { exitCode: number | null; timedOut: boolean },
  hasMarker: boolean,
): string {
  if (result.timedOut) return 'process_exec timed out';
  if (result.exitCode !== 0) {
    return `process_exec exited with code ${String(result.exitCode)}`;
  }
  if (!hasMarker) return 'process_exec stdout did not contain the marker';
  return 'process_exec failed';
}

function errorText(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
