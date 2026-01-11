/**
 * useBoolean
 * 布尔值状态管理
 *
 * @example
 * const [visible, { toggle, setTrue, setFalse }] = useBoolean(false);
 *
 * <button onClick={toggle}>Toggle</button>
 * <button onClick={setTrue}>Show</button>
 * <button onClick={setFalse}>Hide</button>
 */

import { useState, useMemo } from 'react';

export interface UseBooleanActions {
  setTrue: () => void;
  setFalse: () => void;
  toggle: () => void;
  set: (value: boolean) => void;
}

export function useBoolean(defaultValue = false): [boolean, UseBooleanActions] {
  const [state, setState] = useState(defaultValue);

  const actions = useMemo<UseBooleanActions>(() => ({
    setTrue: () => setState(true),
    setFalse: () => setState(false),
    toggle: () => setState((s) => !s),
    set: (value: boolean) => setState(value),
  }), []);

  return [state, actions];
}
