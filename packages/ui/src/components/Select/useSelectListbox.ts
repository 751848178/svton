import { useCallback, useMemo, useRef, useState } from 'react';
import type { SelectOption } from './types';

export interface SelectListboxState {
  /* 上下翻动的高亮索引（-1 = 无） */
  activeIndex: number;
  setActiveIndex: (index: number) => void;
  moveActive: (delta: 1 | -1, count: number) => void;
  setActiveToFirst: () => void;
  setActiveToLast: (count: number) => void;
  resetActive: () => void;
}

/** listbox/combobox 高亮游标：仅维护状态，值提交由消费方 hook 决定。 */
export function useSelectListbox(enabledOptionsLength: number): SelectListboxState {
  const [activeIndex, setState] = useState(-1);
  const activeRef = useRef(-1);

  const setActiveIndex = useCallback((index: number) => {
    activeRef.current = index;
    setState(index);
  }, []);

  const moveActive = useCallback(
    (delta: 1 | -1, count: number) => {
      if (count <= 0) return;
      const base = activeRef.current;
      const next = base < 0
        ? (delta === 1 ? 0 : count - 1)
        : (base + delta + count) % count;
      activeRef.current = next;
      setState(next);
    },
    [],
  );

  const setActiveToFirst = useCallback(() => {
    activeRef.current = 0;
    setState(0);
  }, []);

  const setActiveToLast = useCallback((count: number) => {
    if (count <= 0) return;
    activeRef.current = count - 1;
    setState(count - 1);
  }, []);

  const resetActive = useCallback(() => {
    activeRef.current = -1;
    setState(-1);
  }, []);

  return useMemo(
    () => ({ activeIndex, setActiveIndex, moveActive, setActiveToFirst, setActiveToLast, resetActive }),
    [activeIndex, setActiveIndex, moveActive, setActiveToFirst, setActiveToLast, resetActive],
  );
}

export function filterOptions(options: SelectOption[], search: string, filter?: SelectOptionFilter): SelectOption[] {
  if (!search) return options;
  if (filter === false) return options;
  if (typeof filter === 'function') return options.filter((opt) => filter(opt, search));
  return options.filter((opt) => opt.label.toLowerCase().includes(search.toLowerCase()));
}

export type SelectOptionFilter = ((option: SelectOption, input: string) => boolean) | boolean;
