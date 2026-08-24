import { useCallback } from 'react';
import type { SelectOption } from './types';

interface KeyboardNavParams {
  open: boolean;
  canSearch: boolean;
  enabledOptions: SelectOption[];
  activeIndex: number;
  commit: (option: SelectOption) => void;
  moveActive: (delta: 1 | -1, count: number) => void;
  setActiveToFirst: () => void;
  setActiveToLast: (count: number) => void;
  openPopover: () => void;
  closeAndReset: () => void;
}

/** combobox/listbox 键盘模型：方向/Home/End/Enter/Space/Tab/Escape。 */
export function useSelectKeyboardNav(params: KeyboardNavParams) {
  const {
    open,
    canSearch,
    enabledOptions,
    activeIndex,
    commit,
    moveActive,
    setActiveToFirst,
    setActiveToLast,
    openPopover,
    closeAndReset,
  } = params;

  return useCallback(
    (e: React.KeyboardEvent) => {
      // IME 组合期（拼音/假名候选中）：完全放行给输入法，避免 preventDefault 破坏候选窗
      if ((e.nativeEvent as KeyboardEvent).isComposing) return;
      if (!open) {
        if (e.key === 'Enter' || e.key === 'ArrowDown' || e.key === 'ArrowUp') {
          e.preventDefault();
          openPopover();
        }
        return;
      }
      switch (e.key) {
        case 'Escape':
          e.preventDefault();
          closeAndReset();
          break;
        case 'ArrowDown':
          e.preventDefault();
          moveActive(1, enabledOptions.length);
          break;
        case 'ArrowUp':
          e.preventDefault();
          moveActive(-1, enabledOptions.length);
          break;
        case 'Home':
          if (enabledOptions.length > 0) {
            e.preventDefault();
            setActiveToFirst();
          }
          break;
        case 'End':
          if (enabledOptions.length > 0) {
            e.preventDefault();
            setActiveToLast(enabledOptions.length);
          }
          break;
        case 'Enter':
          e.preventDefault();
          if (activeIndex >= 0 && enabledOptions[activeIndex]) commit(enabledOptions[activeIndex]);
          break;
        case ' ':
          if (!canSearch && activeIndex >= 0 && enabledOptions[activeIndex]) {
            e.preventDefault();
            commit(enabledOptions[activeIndex]);
          }
          break;
        case 'Tab':
          closeAndReset();
          break;
        default:
          break;
      }
    },
    [open, canSearch, enabledOptions, activeIndex, commit, moveActive, setActiveToFirst, setActiveToLast, openPopover, closeAndReset],
  );
}
