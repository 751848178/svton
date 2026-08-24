import { useCallback, useEffect, useMemo, useState } from 'react';
import type { SelectOption, SelectOptionFilter } from './types';
import { useSelectListbox } from './useSelectListbox';
import { useSelectOverlay } from './useSelectOverlay';
import { useSelectKeyboardNav } from './useSelectKeyboardNav';

export interface SelectComboboxModel {
  id: string;
  open: boolean;
  search: string;
  filtered: SelectOption[];
  selectedItems: SelectOption[];
  activeIndex: number;
  activeDescendant: string | undefined;
  canSearch: boolean;
  toggleOpen: () => void;
  openWithInput: () => void;
  close: () => void;
  commit: (option: SelectOption) => void;
  removeValue: (value: string) => void;
  clearAll: () => void;
  handleKeyDown: (e: React.KeyboardEvent) => void;
  handleInputChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  inputRef: React.RefObject<HTMLInputElement | null>;
  panelRef: React.RefObject<HTMLDivElement | null>;
  isSelected: (value: string) => boolean;
  setActiveIndex: (index: number) => void;
}

/** Select 增强分支行为模型：组合 overlay/listbox/keyboard 三个原子 hook。 */
export function useSelectCombobox(params: {
  options: SelectOption[];
  value: string | string[] | undefined;
  searchable?: boolean;
  onSearch?: (input: string) => void;
  filterOption?: SelectOptionFilter;
  multiple?: boolean;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  onChange: (value: string | string[]) => void;
}): SelectComboboxModel {
  const { options, searchable, onSearch, filterOption, multiple, open, onOpenChange, onChange } = params;
  const [uncontrolled, setUncontrolled] = useState<string | string[] | undefined>(undefined);
  const isControlled = params.value !== undefined;
  const value = isControlled ? params.value : uncontrolled;
  const applyValue = useCallback(
    (next: string | string[]) => {
      if (!isControlled) setUncontrolled(next);
      onChange(next);
    },
    [isControlled, onChange],
  );
  const { id, open: revealOpen, filtered, selectedItems, canSearch, toggleOpen, openWithInput, close, inputRef, panelRef, setSearch, search } =
    useSelectOverlay({ options, value, searchable, onSearch, filterOption, open, onOpenChange, onOpenReveal: () => undefined });

  const enabledOptions = filtered.filter((o) => !o.disabled);
  const { activeIndex, moveActive, setActiveIndex, setActiveToFirst, setActiveToLast, resetActive } =
    useSelectListbox(enabledOptions.length);

  useEffect(() => {
    if (revealOpen && enabledOptions.length > 0) setActiveToFirst();
  }, [revealOpen, enabledOptions.length, setActiveToFirst]);

  const commit = useCallback(
    (opt: SelectOption) => {
      if (opt.disabled) return;
      if (multiple) {
        const current = Array.isArray(value) ? value : [];
        const next = current.includes(opt.value)
          ? current.filter((v) => v !== opt.value)
          : [...current, opt.value];
        applyValue(next);
        setSearch('');
        onSearch?.('');
        inputRef.current?.focus();
      } else {
        onOpenChange?.(false);
        close();
        resetActive();
        setSearch('');
        onSearch?.('');
        applyValue(opt.value);
      }
    },
    [multiple, value, applyValue, onSearch, setSearch, inputRef, onOpenChange, close, resetActive],
  );

  const removeValue = useCallback(
    (v: string) => applyValue((Array.isArray(value) ? value : []).filter((item) => item !== v)),
    [value, applyValue],
  );

  const clearAll = useCallback(() => applyValue(multiple ? [] : ''), [multiple, applyValue]);

  const handleKeyDown = useSelectKeyboardNav({
    open: revealOpen,
    canSearch,
    enabledOptions,
    activeIndex,
    commit,
    moveActive,
    setActiveToFirst,
    setActiveToLast,
    openPopover: openWithInput,
    closeAndReset: () => {
      close();
      resetActive();
    },
  });

  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const next = e.target.value;
      setSearch(next);
      resetActive();
      onSearch?.(next);
    },
    [setSearch, resetActive, onSearch],
  );

  const isSelected = (v: string) => (Array.isArray(value) ? value.includes(v) : value === v);

  return useMemo(
    () => ({
      id,
      open: revealOpen,
      search,
      filtered,
      selectedItems,
      activeIndex,
      activeDescendant: revealOpen && activeIndex >= 0 ? `${id}-opt-${activeIndex}` : undefined,
      canSearch,
      toggleOpen,
      openWithInput,
      close,
      commit,
      removeValue,
      clearAll,
      handleKeyDown,
      handleInputChange,
      inputRef,
      panelRef,
      isSelected,
      setActiveIndex,
    }),
    [id, revealOpen, search, filtered, selectedItems, activeIndex, canSearch, toggleOpen, openWithInput, close, commit, removeValue, clearAll, handleKeyDown, handleInputChange, inputRef, panelRef, isSelected, setActiveIndex],
  );
}
