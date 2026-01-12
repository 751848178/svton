/**
 * useUpdate
 * 强制组件重新渲染
 *
 * @example
 * const update = useUpdate();
 *
 * // 某些场景需要强制刷新
 * <button onClick={update}>刷新</button>
 */

import { useState, useCallback } from 'react';

export function useUpdate(): () => void {
  const [, setState] = useState({});

  return useCallback(() => setState({}), []);
}
