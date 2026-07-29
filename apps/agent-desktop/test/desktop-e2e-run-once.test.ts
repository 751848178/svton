import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  claimDesktopE2eDrive,
  finishDesktopE2eDrive,
} from '@/lib/desktop-e2e-run-once.service';

describe('Desktop E2E one-shot ownership', () => {
  beforeEach(() => {
    delete (window as any).__svtonDesktopE2eDriveStarted__;
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it.each(['passed', 'failed'] as const)(
    'does not reclaim a terminal %s drive',
    (outcome) => {
      const first = claimDesktopE2eDrive();
      expect(first.state).toBe('claimed');
      if (first.state !== 'claimed') throw new Error('expected claim');
      expect(claimDesktopE2eDrive()).toEqual({ state: 'waiting' });
      finishDesktopE2eDrive(first.runId, outcome);
      expect(claimDesktopE2eDrive()).toEqual({ state: 'completed' });
    },
  );

  it('takes over stale running ownership', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-07-29T00:00:00Z'));
    const first = claimDesktopE2eDrive();
    expect(first.state).toBe('claimed');
    vi.setSystemTime(new Date('2026-07-29T00:00:26Z'));
    const replacement = claimDesktopE2eDrive();
    expect(replacement.state).toBe('claimed');
    if (first.state === 'claimed' && replacement.state === 'claimed') {
      expect(replacement.runId).not.toBe(first.runId);
    }
  });
});
