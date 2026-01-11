/**
 * useUpdateEffect
 * 忽略首次渲染的 useEffect
 *
 * @example
 * useUpdateEffect(() => {
 *   console.log('只在 count 更新时执行，首次渲染不执行');
 * }, [count]);
 */

import { useEffect, useRef, EffectCallback, DependencyList } from 'react';

export function useUpdateEffect(effect: EffectCallback, deps?: DependencyList) {
  const isMounted = useRef(false);

  useEffect(() => {
    if (!isMounted.current) {
      isMounted.current = true;
      return;
    }
    return effect();
  }, deps);
}
