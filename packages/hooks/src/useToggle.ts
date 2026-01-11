/**
 * useToggle
 * 在两个值之间切换
 *
 * @example
 * const [state, { toggle, setLeft, setRight }] = useToggle('ON', 'OFF');
 * // state: 'ON'
 * toggle(); // state: 'OFF'
 */

import { useState, useMemo } from 'react';

export interface UseToggleActions<T> {
  setLeft: () => void;
  setRight: () => void;
  toggle: () => void;
  set: (value: T) => void;
}

export function useToggle<T = boolean>(
  defaultValue: T = false as T,
  reverseValue?: T,
): [T, UseToggleActions<T>] {
  const [state, setState] = useState<T>(defaultValue);

  const reverseValueOrigin = useMemo(
    () => (reverseValue === undefined ? !defaultValue : reverseValue) as T,
    [defaultValue, reverseValue],
  );

  const actions = useMemo<UseToggleActions<T>>(() => ({
    setLeft: () => setState(defaultValue),
    setRight: () => setState(reverseValueOrigin),
    toggle: () => setState((s) => (s === defaultValue ? reverseValueOrigin : defaultValue)),
    set: (value: T) => setState(value),
  }), [defaultValue, reverseValueOrigin]);

  return [state, actions];
}
