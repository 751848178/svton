/**
 * useDeepCompareEffect
 * 深度比较依赖项的 useEffect
 *
 * @example
 * useDeepCompareEffect(() => {
 *   // 只有当 params 对象的值真正改变时才会执行
 *   fetchData(params);
 * }, [params]);
 */

import { useEffect, useRef, EffectCallback, DependencyList } from 'react';
import { isEqual } from 'lodash-es';

export function useDeepCompareEffect(effect: EffectCallback, deps: DependencyList) {
  const ref = useRef<DependencyList>();
  const signalRef = useRef<number>(0);

  if (!isEqual(deps, ref.current)) {
    ref.current = deps;
    signalRef.current += 1;
  }

  useEffect(effect, [signalRef.current]);
}
