/**
 * useSelections
 * 多选列表管理（全选、反选、部分选中）
 *
 * @example
 * const {
 *   selected,
 *   allSelected,
 *   noneSelected,
 *   partiallySelected,
 *   isSelected,
 *   toggle,
 *   toggleAll,
 *   select,
 *   unSelect,
 *   selectAll,
 *   unSelectAll,
 *   setSelected,
 * } = useSelections(list, []);
 *
 * // 全选复选框
 * <Checkbox
 *   checked={allSelected}
 *   indeterminate={partiallySelected}
 *   onChange={toggleAll}
 * />
 *
 * // 列表项
 * {list.map(item => (
 *   <Checkbox
 *     checked={isSelected(item)}
 *     onChange={() => toggle(item)}
 *   />
 * ))}
 */

import { useState, useMemo, useCallback } from 'react';

export interface UseSelectionsResult<T> {
  selected: T[];
  allSelected: boolean;
  noneSelected: boolean;
  partiallySelected: boolean;
  isSelected: (item: T) => boolean;
  toggle: (item: T) => void;
  toggleAll: () => void;
  select: (item: T) => void;
  unSelect: (item: T) => void;
  selectAll: () => void;
  unSelectAll: () => void;
  setSelected: (items: T[]) => void;
}

export function useSelections<T>(
  items: T[],
  defaultSelected: T[] = [],
): UseSelectionsResult<T> {
  const [selected, setSelected] = useState<T[]>(defaultSelected);

  const selectedSet = useMemo(() => new Set(selected), [selected]);

  const isSelected = useCallback(
    (item: T) => selectedSet.has(item),
    [selectedSet],
  );

  const select = useCallback((item: T) => {
    setSelected((prev) => {
      if (prev.includes(item)) return prev;
      return [...prev, item];
    });
  }, []);

  const unSelect = useCallback((item: T) => {
    setSelected((prev) => prev.filter((i) => i !== item));
  }, []);

  const toggle = useCallback((item: T) => {
    setSelected((prev) => {
      if (prev.includes(item)) {
        return prev.filter((i) => i !== item);
      }
      return [...prev, item];
    });
  }, []);

  const selectAll = useCallback(() => {
    setSelected([...items]);
  }, [items]);

  const unSelectAll = useCallback(() => {
    setSelected([]);
  }, []);

  const toggleAll = useCallback(() => {
    if (selected.length === items.length) {
      unSelectAll();
    } else {
      selectAll();
    }
  }, [selected.length, items.length, selectAll, unSelectAll]);

  const noneSelected = selected.length === 0;
  const allSelected = items.length > 0 && selected.length === items.length;
  const partiallySelected = !noneSelected && !allSelected;

  return {
    selected,
    allSelected,
    noneSelected,
    partiallySelected,
    isSelected,
    toggle,
    toggleAll,
    select,
    unSelect,
    selectAll,
    unSelectAll,
    setSelected,
  };
}
