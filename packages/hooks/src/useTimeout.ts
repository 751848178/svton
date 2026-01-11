/**
 * useTimeout
 * setTimeout 封装
 *
 * @example
 * useTimeout(() => {
 *   setVisible(false);
 * }, 3000);
 *
 * // 传入 null 可以取消
 * useTimeout(callback, shouldRun ? 3000 : null);
 */

import { useEffect, useRef } from 'react';

export function useTimeout(callback: () => void, delay: number | null) {
  const savedCallback = useRef(callback);
  savedCallback.current = callback;

  useEffect(() => {
    if (delay === null) return;

    const id = setTimeout(() => savedCallback.current(), delay);

    return () => clearTimeout(id);
  }, [delay]);
}
