/**
 * useLockFn
 * 防止异步函数重复执行（防重复提交）
 *
 * @example
 * const submit = useLockFn(async () => {
 *   await api.post('/submit', data);
 * });
 *
 * <button onClick={submit}>提交</button>
 * // 连续点击只会执行一次，直到上一次执行完成
 */

import { useRef, useCallback } from 'react';

export function useLockFn<T extends (...args: any[]) => Promise<any>>(fn: T): T {
  const lockRef = useRef(false);

  return useCallback(
    async (...args: Parameters<T>) => {
      if (lockRef.current) return;

      lockRef.current = true;
      try {
        return await fn(...args);
      } finally {
        lockRef.current = false;
      }
    },
    [fn],
  ) as T;
}
