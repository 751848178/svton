/**
 * useUnmount
 * 组件卸载时执行回调
 *
 * @example
 * useUnmount(() => {
 *   console.log('component unmounted');
 * });
 */

import { useEffect, useRef } from 'react';

export function useUnmount(fn: () => void) {
  const fnRef = useRef(fn);
  fnRef.current = fn;

  useEffect(() => {
    return () => {
      fnRef.current();
    };
  }, []);
}
