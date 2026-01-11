/**
 * useDebounceFn
 * 防抖函数
 *
 * @example
 * const { run, cancel, flush } = useDebounceFn(
 *   (value: string) => {
 *     console.log(value);
 *   },
 *   { wait: 500 }
 * );
 */

import { useRef, useEffect, useMemo } from 'react';

export interface DebounceOptions {
  wait?: number;
  leading?: boolean;
  trailing?: boolean;
}

export interface DebouncedFn<T extends (...args: any[]) => any> {
  run: (...args: Parameters<T>) => void;
  cancel: () => void;
  flush: () => void;
}

export function useDebounceFn<T extends (...args: any[]) => any>(
  fn: T,
  options: DebounceOptions = {},
): DebouncedFn<T> {
  const { wait = 300, leading = false, trailing = true } = options;

  const fnRef = useRef(fn);
  fnRef.current = fn;

  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingArgsRef = useRef<Parameters<T> | null>(null);
  const isLeadingInvokedRef = useRef(false);

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
      pendingArgsRef.current = null;
      isLeadingInvokedRef.current = false;
    };

    const flush = () => {
      if (pendingArgsRef.current) {
        fnRef.current(...pendingArgsRef.current);
      }
      cancel();
    };

    const run = (...args: Parameters<T>) => {
      pendingArgsRef.current = args;

      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }

      if (leading && !isLeadingInvokedRef.current) {
        isLeadingInvokedRef.current = true;
        fnRef.current(...args);
      }

      timerRef.current = setTimeout(() => {
        if (trailing && pendingArgsRef.current) {
          if (!leading || isLeadingInvokedRef.current) {
            fnRef.current(...pendingArgsRef.current);
          }
        }
        isLeadingInvokedRef.current = false;
        pendingArgsRef.current = null;
        timerRef.current = null;
      }, wait);
    };

    return { run, cancel, flush };
  }, [wait, leading, trailing]);
}
