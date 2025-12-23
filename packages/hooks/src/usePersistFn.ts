/**
 * usePersistFn
 * 持久化函数引用，避免因函数引用变化导致的额外渲染
 *
 * @example
 * const fn = usePersistFn((val) => {
 *   console.log(val);
 * });
 * // fn 的引用永远不会改变
 */

import { useRef } from 'react';

type noop = (this: any, ...args: any[]) => any;

export function usePersistFn<T extends noop>(fn: T) {
  const fnRef = useRef<T>(fn);
  fnRef.current = fn;

  const persistFn = useRef<T>();
  if (!persistFn.current) {
    persistFn.current = function (this: any, ...args) {
      return fnRef.current.apply(this, args);
    } as T;
  }

  return persistFn.current;
}
