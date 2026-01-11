/**
 * usePrevious
 * 获取上一次渲染时的值
 *
 * @example
 * const [count, setCount] = useState(0);
 * const prevCount = usePrevious(count);
 * // count: 1, prevCount: 0
 */

import { useRef } from 'react';

export function usePrevious<T>(value: T): T | undefined {
  const prevRef = useRef<T>();
  const curRef = useRef<T>(value);

  if (curRef.current !== value) {
    prevRef.current = curRef.current;
    curRef.current = value;
  }

  return prevRef.current;
}
