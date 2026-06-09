import React, { useState, useRef, ReactNode } from 'react';
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
  const { items, activeKey: controlledKey, defaultActiveKey, onChange, type = 'line', className } = props;
  const [internalKey, setInternalKey] = useState(defaultActiveKey || items[0]?.key);
  const activeKey = controlledKey ?? internalKey;
  const tabListRef = useRef<HTMLDivElement>(null);

  const handleClick = (key: string, disabled?: boolean) => {
    if (disabled) return;
    setInternalKey(key);
    onChange?.(key);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
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
      // Focus the new tab
      const tabId = `tab-${nextKey}`;
      document.getElementById(tabId)?.focus();
    }
  };

  const activeItem = items.find((item) => item.key === activeKey);

  return (
    <div className={className}>
      <div
        ref={tabListRef}
        role="tablist"
        onKeyDown={handleKeyDown}
        className={cn('flex', type === 'line' ? 'border-b border-black/5' : 'gap-1')}
      >
        {items.map((item) => {
          const isActive = item.key === activeKey;

          return (
            <div
              key={item.key}
              id={`tab-${item.key}`}
              role="tab"
              tabIndex={isActive ? 0 : -1}
              aria-selected={isActive}
              aria-controls={`tabpanel-${item.key}`}
              onClick={() => handleClick(item.key, item.disabled)}
              className={cn(
                'px-4 py-3 text-sm transition-all outline-none focus-visible:ring-2 focus-visible:ring-blue-400 focus-visible:ring-offset-1 rounded-t',
                item.disabled ? 'cursor-not-allowed opacity-50' : 'cursor-pointer',
                type === 'line' && [
                  '-mb-px',
                  isActive ? 'text-blue-500 border-b-2 border-blue-500 font-medium' : 'text-black/65 border-b-2 border-transparent hover:text-black/85',
                ],
                type === 'card' && [
                  'border border-black/5 rounded-t-lg',
                  isActive ? 'bg-white border-b-white font-medium' : 'bg-black/[0.02] hover:bg-black/[0.04]',
                ]
              )}
            >
              {item.label}
            </div>
          );
        })}
      </div>
      <div
        role="tabpanel"
        id={`tabpanel-${activeKey}`}
        aria-labelledby={`tab-${activeKey}`}
        className="py-4"
      >
        {activeItem?.children}
      </div>
    </div>
  );
}
