import { getE2eStartupFailureSource } from './e2e-provider';

export type E2eStartupFailureSource = 'config' | 'chat' | 'session' | 'project';

const RELEASE_KEY_PREFIX = 'agent-web:e2e-startup-release:';
const SECRET_FIXTURE = 'e2e-startup-secret-token-value';

/** Data-gated, one-shot failure seam used only by deterministic browser E2E. */
export async function injectE2eStartupFailure(
  source: E2eStartupFailureSource,
): Promise<void> {
  if (getE2eStartupFailureSource() !== source || typeof window === 'undefined') return;
  if (window.sessionStorage.getItem(`${RELEASE_KEY_PREFIX}${source}`)) return;
  throw new Error(`${source} startup failed; api_key=${SECRET_FIXTURE}`);
}

/** Releases the selected source immediately before the E2E user clicks Retry. */
export function releaseE2eStartupFailure(source: E2eStartupFailureSource): void {
  if (getE2eStartupFailureSource() !== source || typeof window === 'undefined') return;
  window.sessionStorage.setItem(`${RELEASE_KEY_PREFIX}${source}`, 'released');
}

export const E2E_STARTUP_SECRET_FIXTURE = SECRET_FIXTURE;
