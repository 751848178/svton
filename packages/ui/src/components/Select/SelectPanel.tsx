import React, { useEffect, useRef } from 'react';
import type { CSSProperties, ReactNode, RefObject } from 'react';
import type { SelectOption } from './types';
import { cn } from '../../lib/utils';

interface ValueItemsMap {
  isSelected: (value: string) => boolean;
}

interface SelectPanelProps {
  id: string;
  filtered: SelectOption[];
  activeIndex: number;
  multiple?: boolean;
  loading?: boolean;
  emptyText?: ReactNode;
  renderOption?: (option: SelectOption, index: number) => ReactNode;
  onActivate: (option: SelectOption) => void;
  onHover: (index: number) => void;
  panelRef: RefObject<HTMLDivElement | null>;
  style: CSSProperties;
  value: ValueItemsMap;
}

export function SelectPanel(props: SelectPanelProps) {
  const {
    id,
    filtered,
    activeIndex,
    multiple,
    loading,
    emptyText,
    renderOption,
    onActivate,
    onHover,
    panelRef,
    style,
    value,
  } = props;

  // 键盘高亮项滚动跟随：保证活动选项始终在可视区内
  const optionRefs = useRef<Map<number, HTMLDivElement>>(new Map());
  useEffect(() => {
    if (activeIndex < 0) return;
    const node = optionRefs.current.get(activeIndex);
    // jsdom 无 scrollIntoView；真实浏览器均支持
    if (node && typeof node.scrollIntoView === 'function') {
      node.scrollIntoView({ block: 'nearest' });
    }
  }, [activeIndex]);

  return (
    <div
      ref={panelRef}
      id={id}
      role="listbox"
      aria-multiselectable={multiple || undefined}
      onMouseDown={(e) => e.preventDefault()}
      className="absolute z-50 mt-1 max-h-64 overflow-auto rounded-md border border-border bg-popover py-1 text-popover-foreground shadow-lg"
      style={style}
    >
      {filtered.length === 0 ? (
        <div className="px-3 py-2 text-sm text-muted-foreground">
          {loading ? 'Loading…' : (emptyText ?? 'No options')}
        </div>
      ) : (
        filtered.map((opt, index) => {
          const isActive = activeIndex === index;
          const selected = value.isSelected(opt.value);
          return (
            <div
              key={opt.value}
              id={`${id}-opt-${index}`}
              ref={(node) => {
                if (node) optionRefs.current.set(index, node);
                else optionRefs.current.delete(index);
              }}
              role="option"
              aria-selected={selected}
              aria-disabled={opt.disabled || undefined}
              className={cn(
                'flex cursor-pointer items-center px-3 py-1.5 text-sm outline-none',
                isActive && 'bg-accent',
                opt.disabled && 'pointer-events-none opacity-50',
              )}
              onMouseEnter={() => onHover(index)}
              onClick={() => onActivate(opt)}
            >
              {multiple && (
                <span
                  className={cn(
                    'mr-2 inline-flex size-3.5 shrink-0 items-center justify-center rounded-sm border border-border text-[10px]',
                    selected && 'border-primary bg-primary text-primary-foreground',
                  )}
                >
                  {selected ? '✓' : ''}
                </span>
              )}
              {renderOption ? (
                renderOption(opt, index)
              ) : (
                <span className="min-w-0 flex-1 truncate" title={opt.label}>
                  {opt.label}
                </span>
              )}
            </div>
          );
        })
      )}
    </div>
  );
}
