import React, { useState, useRef, useId, useCallback, ReactNode } from 'react';
import { cn } from '../../lib/utils';

export interface TabItem {
  key: string;
  label: ReactNode;
  children: ReactNode;
  disabled?: boolean;
}

export interface TabsProps {
  items: TabItem[];
  activeKey?: string;
  defaultActiveKey?: string;
  onChange?: (key: string) => void;
  type?: 'line' | 'card';
  className?: string;
}

export function Tabs(props: TabsProps) {
  const {
    items,
    activeKey: controlledKey,
    defaultActiveKey,
    onChange,
    type = 'line',
    className,
  } = props;
  const [internalKey, setInternalKey] = useState(defaultActiveKey || items[0]?.key);
  const activeKey = controlledKey ?? internalKey;
  const idBase = useId().replace(/:/g, '');
  const tabRefs = useRef<Map<string, HTMLDivElement>>(new Map());

  const handleClick = useCallback(
    (key: string, disabled?: boolean) => {
      if (disabled) return;
      setInternalKey(key);
      onChange?.(key);
    },
    [onChange],
  );

  const focusTab = useCallback((key: string) => {
    tabRefs.current.get(key)?.focus();
  }, []);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      const enabledItems = items.filter((item) => !item.disabled);
      const currentIndex = enabledItems.findIndex((item) => item.key === activeKey);
      let nextIndex = -1;

      if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
        nextIndex = (currentIndex + 1) % enabledItems.length;
      } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
        nextIndex = (currentIndex - 1 + enabledItems.length) % enabledItems.length;
      } else if (e.key === 'Home') {
        nextIndex = 0;
      } else if (e.key === 'End') {
        nextIndex = enabledItems.length - 1;
      }

      if (nextIndex >= 0) {
        e.preventDefault();
        const nextKey = enabledItems[nextIndex].key;
        setInternalKey(nextKey);
        onChange?.(nextKey);
        focusTab(nextKey);
      }
    },
    [items, activeKey, onChange, focusTab],
  );

  const activeIndex = items.findIndex((item) => item.key === activeKey);
  const activeItem = activeIndex >= 0 ? items[activeIndex] : undefined;
  const tabPanelId = `tabpanel-${idBase}-${activeIndex}`;

  return (
    <div className={className}>
      <div
        role="tablist"
        aria-orientation="horizontal"
        onKeyDown={handleKeyDown}
        className={cn('flex', type === 'line' ? 'border-b border-border' : 'gap-1')}
      >
        {items.map((item, index) => {
          const isActive = item.key === activeKey;
          return (
            <div
              key={item.key}
              id={`tab-${idBase}-${index}`}
              ref={(node) => {
                if (node) tabRefs.current.set(item.key, node);
                else tabRefs.current.delete(item.key);
              }}
              role="tab"
              tabIndex={isActive ? 0 : -1}
              aria-selected={isActive}
              aria-controls={tabPanelId}
              onClick={() => handleClick(item.key, item.disabled)}
              className={cn(
                'rounded-t px-4 py-3 text-sm outline-none transition-all focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1',
                item.disabled ? 'cursor-not-allowed opacity-50' : 'cursor-pointer',
                type === 'line' && [
                  '-mb-px',
                  isActive
                    ? 'border-b-2 border-primary font-medium text-primary'
                    : 'border-b-2 border-transparent text-muted-foreground hover:text-foreground',
                ],
                type === 'card' && [
                  'border border-border rounded-t-lg',
                  isActive
                    ? 'bg-card border-b-card font-medium'
                    : 'bg-muted/50 hover:bg-muted',
                ],
              )}
            >
              {item.label}
            </div>
          );
        })}
      </div>
      <div
        id={tabPanelId}
        role="tabpanel"
        aria-labelledby={`tab-${idBase}-${activeIndex}`}
        className="py-4"
      >
        {activeItem?.children}
      </div>
    </div>
  );
}
