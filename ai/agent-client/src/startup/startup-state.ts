import { redactSecrets } from '@svton/agent-core';

export type StartupSource = 'provider' | 'config' | 'chat' | 'session' | 'project';

export type StartupTaskResult<T> =
  | { kind: 'ready'; value: T }
  | { kind: 'noConfiguration'; cause?: string };

export type StartupState<T> =
  | { phase: 'loading'; source: StartupSource; generation: number }
  | { phase: 'ready'; source: StartupSource; generation: number; value: T }
  | { phase: 'noConfiguration'; source: StartupSource; generation: number; cause?: string }
  | {
      phase: 'error';
      source: StartupSource;
      generation: number;
      cause: string;
      retryable: true;
    };

export function loadingStartup<T>(
  source: StartupSource,
  generation: number,
): StartupState<T> {
  return { phase: 'loading', source, generation };
}

export function settleStartup<T>(
  source: StartupSource,
  generation: number,
  result: StartupTaskResult<T>,
): StartupState<T> {
  return result.kind === 'ready'
    ? { phase: 'ready', source, generation, value: result.value }
    : {
        phase: 'noConfiguration',
        source,
        generation,
        ...(result.cause ? { cause: normalizeStartupCause(result.cause) } : {}),
      };
}

export function failStartup<T>(
  source: StartupSource,
  generation: number,
  error: unknown,
): StartupState<T> {
  return {
    phase: 'error',
    source,
    generation,
    cause: normalizeStartupCause(error),
    retryable: true,
  };
}

export function normalizeStartupCause(error: unknown): string {
  const raw = error instanceof Error ? error.message : String(error || 'Initialization failed');
  return redactSecrets(raw).replace(/\s+/g, ' ').trim().slice(0, 500)
    || 'Initialization failed';
}
