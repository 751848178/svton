import React, { useState, useId, useRef, useEffect, ReactNode, useCallback } from 'react';
import { cn } from '../../lib/utils';

export interface CollapseItemProps {
  title: ReactNode;
  children: ReactNode;
  defaultOpen?: boolean;
  disabled?: boolean;
  extra?: ReactNode;
  className?: string;
}

export function CollapseItem(props: CollapseItemProps) {
  const { title, children, defaultOpen = false, disabled = false, extra, className } = props;
  const [open, setOpen] = useState(defaultOpen);
  const [height, setHeight] = useState<number | 'auto'>(defaultOpen ? 'auto' : 0);
  const panelId = useId();
  const contentRef = useRef<HTMLDivElement>(null);

  const handleToggle = () => !disabled && setOpen(!open);

  // Animate height changes
  useEffect(() => {
    if (!contentRef.current) return;

    if (open) {
      const el = contentRef.current;
      // Measure natural height
      el.style.height = 'auto';
      const naturalHeight = el.scrollHeight;
      // Start from 0
      el.style.height = '0px';
      // Force reflow
      el.offsetHeight; // eslint-disable-line no-unused-expressions
      // Animate to natural height
      el.style.height = naturalHeight + 'px';

      const onEnd = () => {
        el.style.height = 'auto';
        setHeight('auto');
        el.removeEventListener('transitionend', onEnd);
      };
      el.addEventListener('transitionend', onEnd);
    } else {
      const el = contentRef.current;
      const currentHeight = el.scrollHeight;
      el.style.height = currentHeight + 'px';
      // Force reflow
      el.offsetHeight;
      el.style.height = '0px';
    }
  }, [open]);

  return (
    <div className={cn('border-b border-black/5', className)}>
      <div
        role="button"
        tabIndex={disabled ? -1 : 0}
        aria-expanded={open}
        aria-controls={panelId}
        onClick={handleToggle}
        onKeyDown={(e) => {
          if (!disabled && (e.key === 'Enter' || e.key === ' ')) {
            e.preventDefault();
            handleToggle();
          }
        }}
        className={cn(
          'flex items-center justify-between px-4 py-3 select-none outline-none focus-visible:ring-2 focus-visible:ring-blue-400 focus-visible:ring-offset-1 rounded',
          disabled ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'
        )}
      >
        <div className="flex items-center gap-2">
          <svg
            width="12"
            height="12"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            aria-hidden="true"
            className={cn('transition-transform duration-200', open && 'rotate-90')}
          >
            <polyline points="9 18 15 12 9 6" />
          </svg>
          <span className="font-medium">{title}</span>
        </div>
        {extra}
      </div>
      <div
        id={panelId}
        role="region"
        ref={contentRef}
        className="collapse-panel"
        style={{ height: height === 'auto' ? 'auto' : height }}
      >
        <div className="px-4 pb-4 pl-9">{children}</div>
      </div>
    </div>
  );
}

export interface CollapseProps {
  children: ReactNode;
  bordered?: boolean;
  className?: string;
}

export function Collapse(props: CollapseProps) {
  const { children, bordered = true, className } = props;

  return (
    <div className={cn(bordered && 'border border-black/5 rounded-lg overflow-hidden', className)}>
      {children}
    </div>
  );
}
