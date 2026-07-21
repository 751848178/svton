export interface HttpAbortOptions {
  signal?: AbortSignal;
  timeoutMs?: number;
}

export function createHttpAbortSignal(opts?: HttpAbortOptions): AbortSignal | undefined {
  const timeoutSignal = opts?.timeoutMs ? AbortSignal.timeout(opts.timeoutMs) : undefined;
  const inputSignal = opts?.signal;

  if (inputSignal && timeoutSignal) return linkSignals([inputSignal, timeoutSignal]);
  return inputSignal ?? timeoutSignal;
}

function linkSignals(signals: AbortSignal[]): AbortSignal {
  const controller = new AbortController();
  const removers: Array<() => void> = [];
  const abort = (signal: AbortSignal) => {
    if (!controller.signal.aborted) controller.abort(signal.reason);
    for (const remove of removers) remove();
  };

  for (const signal of signals) {
    if (signal.aborted) {
      abort(signal);
      break;
    }
    const listener = () => abort(signal);
    signal.addEventListener('abort', listener, { once: true });
    removers.push(() => signal.removeEventListener('abort', listener));
  }

  return controller.signal;
}
