import React, { useState, ReactNode } from 'react';
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

  const handleClick = (key: string, disabled?: boolean) => {
    if (disabled) return;
    setInternalKey(key);
    onChange?.(key);
  };

  const activeItem = items.find((item) => item.key === activeKey);

  return (
    <div className={className}>
      <div className={cn('flex', type === 'line' ? 'border-b border-black/5' : 'gap-1')}>
        {items.map((item) => {
          const isActive = item.key === activeKey;

          return (
            <div
              key={item.key}
              onClick={() => handleClick(item.key, item.disabled)}
              className={cn(
                'px-4 py-3 text-sm transition-all',
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
      <div className="py-4">{activeItem?.children}</div>
    </div>
  );
}
