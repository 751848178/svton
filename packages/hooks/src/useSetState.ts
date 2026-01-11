/**
 * useSetState
 * 类似 class 组件的 setState，支持对象合并
 *
 * @example
 * const [state, setState] = useSetState({ name: '', age: 0 });
 *
 * setState({ name: 'John' }); // { name: 'John', age: 0 }
 * setState((prev) => ({ age: prev.age + 1 })); // { name: 'John', age: 1 }
 */

import { useState, useCallback } from 'react';

export function useSetState<T extends Record<string, any>>(
  initialState: T | (() => T),
): [T, (patch: Partial<T> | ((prev: T) => Partial<T>)) => void] {
  const [state, setState] = useState<T>(initialState);

  const setMergeState = useCallback((patch: Partial<T> | ((prev: T) => Partial<T>)) => {
    setState((prev) => {
      const newPatch = typeof patch === 'function' ? patch(prev) : patch;
      return { ...prev, ...newPatch };
    });
  }, []);

  return [state, setMergeState];
}
