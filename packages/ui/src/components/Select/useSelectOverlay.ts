import { useState, useEffect, useCallback, useRef, useId } from 'react';
import type { SelectOption, SelectOptionFilter } from './types';
import { filterOptions } from './useSelectListbox';

const toSelected = (values: string | string[] | undefined, options: SelectOption[]): SelectOption[] => {
  const raw = Array.isArray(values) ? values : values === undefined ? [] : [values];
  return raw
    .map((v) => options.find((o) => o.value === v))
    .filter((o): o is SelectOption => Boolean(o));
};

export interface SelectOverlayModel {
  id: string;
  open: boolean;
  search: string;
  setSearch: (next: string) => void;
  filtered: SelectOption[];
  selectedItems: SelectOption[];
  canSearch: boolean;
  toggleOpen: () => void;
  openWithInput: () => void;
  close: () => void;
  inputRef: React.RefObject<HTMLInputElement | null>;
  panelRef: React.RefObject<HTMLDivElement | null>;
}

/** 浮层显隐 + 搜索 + 文档级关闭；输入框与面板 ref 归此管理。 */
export function useSelectOverlay(params: {
  options: SelectOption[];
  value: string | string[] | undefined;
  searchable?: boolean;
  onSearch?: (input: string) => void;
  filterOption?: SelectOptionFilter;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  onOpenReveal: () => void;
}): SelectOverlayModel {
  const { options, value, searchable, onSearch, filterOption, open: controlledOpen, onOpenChange, onOpenReveal } = params;
  const id = useId().replace(/:/g, '');

  const [internalOpen, setInternalOpen] = useState(false);
  const open = controlledOpen ?? internalOpen;
  const [search, setSearch] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const panelRef = useRef<HTMLDivElement | null>(null);

  const canSearch = Boolean(searchable || onSearch);
  const filtered = canSearch ? filterOptions(options, search, filterOption) : options;
  const selectedItems = toSelected(value, options);

  const setOpen = useCallback(
    (next: boolean, focusInput = false) => {
      setInternalOpen(next);
      onOpenChange?.(next);
      if (next && focusInput) window.setTimeout(() => inputRef.current?.focus(), 0);
    },
    [onOpenChange],
  );

  const toggleOpen = useCallback(() => setOpen(!open), [open, setOpen]);
  const openWithInput = useCallback(() => {
    if (open) inputRef.current?.focus();
    else setOpen(true, true);
  }, [open, setOpen]);
  const close = useCallback(() => setOpen(false), [setOpen]);

  useEffect(() => {
    if (!open) return;
    onOpenReveal();
    if (canSearch) inputRef.current?.focus();
  }, [open, onOpenReveal, canSearch]);

  useEffect(() => {
    if (!open) return;
    const onDocDown = (e: MouseEvent) => {
      const target = e.target as Node;
      if (inputRef.current?.contains(target) || panelRef.current?.contains(target)) return;
      close();
    };
    document.addEventListener('mousedown', onDocDown);
    return () => document.removeEventListener('mousedown', onDocDown);
  }, [open, close]);

  return {
    id,
    open,
    search,
    setSearch,
    filtered,
    selectedItems,
    canSearch,
    toggleOpen,
    openWithInput,
    close,
    inputRef,
    panelRef,
  };
}
