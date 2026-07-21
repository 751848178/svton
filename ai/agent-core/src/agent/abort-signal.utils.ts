export function linkAbortSignal(controller: AbortController, signal?: AbortSignal): () => void {
  if (!signal) return () => {};

  const abort = () => abortController(controller, signal);
  if (signal.aborted) {
    abort();
    return () => {};
  }

  signal.addEventListener('abort', abort, { once: true });
  return () => signal.removeEventListener('abort', abort);
}

export function isAbortSignalAborted(...signals: Array<AbortSignal | null | undefined>): boolean {
  return signals.some((signal) => signal?.aborted);
}

function abortController(controller: AbortController, signal: AbortSignal): void {
  if (!controller.signal.aborted) {
    controller.abort(signal.reason);
  }
}
