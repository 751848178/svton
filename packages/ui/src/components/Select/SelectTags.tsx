import React from 'react';
import type { SelectOption } from './types';
import { cn } from '../../lib/utils';
import { CloseIcon } from '../../icons';

interface SelectTagsProps {
  items: SelectOption[];
  disabled?: boolean;
  clearable?: boolean;
  onRemove: (value: string) => void;
  onClearAll: () => void;
}

/** 多选芯片：item + 单个移除 + 一键清空（clearable）。 */
export function SelectTags(props: SelectTagsProps) {
  const { items, disabled, clearable, onRemove, onClearAll } = props;
  return (
    <div className="flex w-full min-w-0 flex-1 flex-wrap items-center gap-1">
      {items.map((item) => (
        <span
          key={item.value}
          className="inline-flex items-center gap-1 rounded-sm bg-muted px-1.5 py-0.5 text-xs text-foreground"
        >
          {item.label}
          <button
            type="button"
            aria-label={`Remove ${item.label}`}
            disabled={disabled}
            onClick={(e) => {
              e.stopPropagation();
              onRemove(item.value);
            }}
            className="inline-flex size-3.5 items-center justify-center rounded-full text-muted-foreground hover:text-foreground"
          >
            <CloseIcon size={10} aria-hidden="true" />
          </button>
        </span>
      ))}
      {clearable && items.length > 0 && (
        <button
          type="button"
          aria-label="Clear all"
          disabled={disabled}
          onClick={(e) => {
            e.stopPropagation();
            onClearAll();
          }}
          className="inline-flex size-4 items-center justify-center rounded-full text-muted-foreground hover:text-foreground"
        >
          <CloseIcon size={12} aria-hidden="true" />
        </button>
      )}
    </div>
  );
}
