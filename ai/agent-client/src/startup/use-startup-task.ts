import { useCallback, useEffect, useRef, useState } from 'react';
import {
  failStartup,
  loadingStartup,
  settleStartup,
  type StartupSource,
  type StartupState,
  type StartupTaskResult,
} from './startup-state';

export interface StartupTaskController<T> {
  state: StartupState<T>;
  retry: () => void;
}

interface StartupTaskOptions<T> {
  source: StartupSource;
  generationKey: unknown;
  load: () => Promise<StartupTaskResult<T>>;
}

/** Runs one initialization source with stale-generation rejection and in-place retry. */
export function useStartupTask<T>({
  source,
  generationKey,
  load,
}: StartupTaskOptions<T>): StartupTaskController<T> {
  const loadRef = useRef(load);
  const generationRef = useRef(0);
  const settledKeyRef = useRef<unknown>(Symbol('unsettled'));
  const [retryNonce, setRetryNonce] = useState(0);
  const [state, setState] = useState<StartupState<T>>(() => loadingStartup(source, 0));
  loadRef.current = load;

  useEffect(() => {
    const generation = ++generationRef.current;
    settledKeyRef.current = Symbol('loading');
    setState(loadingStartup(source, generation));
    void Promise.resolve().then(() => loadRef.current()).then(
      (result) => {
        if (generationRef.current === generation) {
          settledKeyRef.current = generationKey;
          setState(settleStartup(source, generation, result));
        }
      },
      (error) => {
        if (generationRef.current === generation) {
          settledKeyRef.current = generationKey;
          setState(failStartup(source, generation, error));
        }
      },
    );
    return () => {
      if (generationRef.current === generation) generationRef.current += 1;
    };
  }, [source, generationKey, retryNonce]);

  const retry = useCallback(() => setRetryNonce((value) => value + 1), []);
  const visibleState = settledKeyRef.current === generationKey
    ? state
    : loadingStartup<T>(source, generationRef.current + 1);
  return { state: visibleState, retry };
}
