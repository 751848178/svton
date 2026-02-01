/**
 * useSafeState
 * 安全的 useState，在组件卸载后不会更新状态，避免内存泄漏警告
 *
 * @example
 * const [state, setState] = useSafeState(0);
 *
 * // 即使组件已卸载，调用 setState 也不会报错
 * setTimeout(() => {
 *   setState(1);
 * }, 3000);
 */

import { useState, useCallback, useRef, useEffect, Dispatch, SetStateAction } from 'react';

export function useSafeState<S>(initialState: S | (() => S)): [S, Dispatch<SetStateAction<S>>];
export function useSafeState<S = undefined>(): [S | undefined, Dispatch<SetStateAction<S | undefined>>];

export function useSafeState<S>(initialState?: S | (() => S)) {
  const [state, setState] = useState<S>(initialState as S | (() => S));
  const isMountedRef = useRef(false);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const setSafeState = useCallback((value: SetStateAction<S>) => {
    if (isMountedRef.current) {
      setState(value);
    }
  }, []);

  return [state, setSafeState] as [S, Dispatch<SetStateAction<S>>];
}
