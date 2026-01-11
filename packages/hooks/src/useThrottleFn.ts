/**
 * useThrottleFn
 * 节流函数
 *
 * @example
 * const { run, cancel } = useThrottleFn(
 *   (value: string) => {
 *     console.log(value);
 *   },
 *   { wait: 500 }
 * );
 */

import { useRef, useEffect, useMemo } from 'react';

export interface ThrottleOptions {
  wait?: number;
  leading?: boolean;
  trailing?: boolean;
}

export interface ThrottledFn<T extends (...args: any[]) => any> {
  run: (...args: Parameters<T>) => void;
  cancel: () => void;
}

export function useThrottleFn<T extends (...args: any[]) => any>(
  fn: T,
  options: ThrottleOptions = {},
): ThrottledFn<T> {
  const { wait = 300, leading = true, trailing = true } = options;

  const fnRef = useRef(fn);
  fnRef.current = fn;

  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastArgsRef = useRef<Parameters<T> | null>(null);
  const lastExecRef = useRef(0);

  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    };
  }, []);

  return useMemo(() => {
    const cancel = () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
      lastArgsRef.current = null;
    };

    const run = (...args: Parameters<T>) => {
      const now = Date.now();
      const remaining = wait - (now - lastExecRef.current);

      lastArgsRef.current = args;

      if (remaining <= 0 || remaining > wait) {
        if (timerRef.current) {
          clearTimeout(timerRef.current);
          timerRef.current = null;
        }
        if (leading || lastExecRef.current !== 0) {
          lastExecRef.current = now;
          fnRef.current(...args);
        } else {
          lastExecRef.current = now;
        }
      } else if (!timerRef.current && trailing) {
        timerRef.current = setTimeout(() => {
          lastExecRef.current = leading ? Date.now() : 0;
          timerRef.current = null;
          if (lastArgsRef.current) {
            fnRef.current(...lastArgsRef.current);
          }
        }, remaining);
      }
    };

    return { run, cancel };
  }, [wait, leading, trailing]);
}
