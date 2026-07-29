import type { IPlatform } from '@svton/agent-platform';
import {
  buildDesktopE2eResult,
  persistDesktopE2eResult,
} from './desktop-e2e-evidence.service';
import { desktopE2eActive } from './e2e-provider';

const WATCHDOG_MS = 30_000;

export interface DesktopE2eBootstrap {
  started: Promise<void>;
  failInitialization: (reason: string) => Promise<void>;
  dispose: () => void;
}

export function startDesktopE2eBootstrap(
  platform: IPlatform,
): DesktopE2eBootstrap {
  if (!desktopE2eActive()) return inertBootstrap();
  const startedAt = Date.now();
  let disposed = false;
  let watchdog: ReturnType<typeof setTimeout> | undefined;
  const writeFailure = async (status: string, error: string) => {
    if (disposed || hasTerminalWindowEvidence()) return;
    if (watchdog) clearTimeout(watchdog);
    await persistDesktopE2eResult(
      platform,
      buildDesktopE2eResult('failed', [], status, startedAt, error),
    );
  };
  const started = persistDesktopE2eResult(
    platform,
    buildDesktopE2eResult('running', [], 'bootstrap', startedAt),
  );
  watchdog = setTimeout(() => {
    void writeFailure(
      'bootstrap_timeout',
      'AgentProvider/AutoDrive did not reach a terminal state within 30000ms',
    );
  }, WATCHDOG_MS);
  return {
    started,
    failInitialization: (reason) => writeFailure(
      'initialization_failed',
      `Desktop initialization did not reach ready (${reason})`,
    ),
    dispose: () => {
      disposed = true;
      if (watchdog) clearTimeout(watchdog);
    },
  };
}

function hasTerminalWindowEvidence(): boolean {
  if (typeof window === 'undefined') return false;
  const evidence = (window as Window & {
    __svtonDesktopE2e__?: { state?: unknown };
  }).__svtonDesktopE2e__;
  return evidence?.state === 'passed' || evidence?.state === 'failed';
}

function inertBootstrap(): DesktopE2eBootstrap {
  return {
    started: Promise.resolve(),
    failInitialization: async () => {},
    dispose: () => {},
  };
}
