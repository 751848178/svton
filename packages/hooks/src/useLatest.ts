/**
 * useLatest
 * 返回当前最新值的 ref，避免闭包陷阱
 *
 * @example
 * const [count, setCount] = useState(0);
 * const latestCount = useLatest(count);
 *
 * useEffect(() => {
 *   const timer = setInterval(() => {
 *     console.log(latestCount.current); // 始终是最新值
 *   }, 1000);
 *   return () => clearInterval(timer);
 * }, []);
 */

import { useRef, MutableRefObject } from 'react';

export function useLatest<T>(value: T): MutableRefObject<T> {
  const ref = useRef(value);
  ref.current = value;
  return ref;
}
