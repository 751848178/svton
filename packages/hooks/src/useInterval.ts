/**
 * useInterval
 * setInterval 封装
 *
 * @example
 * const [count, setCount] = useState(0);
 *
 * useInterval(() => {
 *   setCount(count + 1);
 * }, 1000);
 *
 * // 传入 null 可以暂停
 * useInterval(callback, isRunning ? 1000 : null);
 */

import { useEffect, useRef } from 'react';

export function useInterval(callback: () => void, delay: number | null) {
  const savedCallback = useRef(callback);
  savedCallback.current = callback;

  useEffect(() => {
    if (delay === null) return;

    const tick = () => savedCallback.current();
    const id = setInterval(tick, delay);

    return () => clearInterval(id);
  }, [delay]);
}
