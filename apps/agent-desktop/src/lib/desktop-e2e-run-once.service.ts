const DRIVE_STARTED = '__svtonDesktopE2eDriveStarted__';

interface DriveState {
  runId: string;
  phase: 'running' | 'terminal';
  startedAt: number;
  outcome?: 'passed' | 'failed';
}

type DriveWindow = Window & { [DRIVE_STARTED]?: DriveState };
const STALE_RUN_MS = 25_000;

export type DesktopE2eDriveClaim =
  | { state: 'claimed'; runId: string }
  | { state: 'waiting' }
  | { state: 'completed' };

export function claimDesktopE2eDrive(): DesktopE2eDriveClaim {
  if (typeof window === 'undefined') return { state: 'completed' };
  const e2eWindow = window as DriveWindow;
  const current = e2eWindow[DRIVE_STARTED];
  if (current?.phase === 'terminal') return { state: 'completed' };
  if (
    current?.phase === 'running'
    && Date.now() - current.startedAt < STALE_RUN_MS
  ) return { state: 'waiting' };
  const runId = `desktop-e2e-${Date.now()}-${Math.random()}`;
  e2eWindow[DRIVE_STARTED] = {
    runId,
    phase: 'running',
    startedAt: Date.now(),
  };
  return { state: 'claimed', runId };
}

export function finishDesktopE2eDrive(
  runId: string,
  outcome: 'passed' | 'failed',
): void {
  if (typeof window === 'undefined') return;
  const e2eWindow = window as DriveWindow;
  if (e2eWindow[DRIVE_STARTED]?.runId !== runId) return;
  e2eWindow[DRIVE_STARTED] = {
    runId,
    phase: 'terminal',
    startedAt: e2eWindow[DRIVE_STARTED]!.startedAt,
    outcome,
  };
}
