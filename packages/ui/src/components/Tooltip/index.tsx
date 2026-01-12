import React, { useState, useRef, useEffect, ReactNode } from 'react';
import { cn } from '../../lib/utils';
import { Portal } from '../Portal';

type Placement = 'top' | 'bottom' | 'left' | 'right';

export interface TooltipProps {
  content: ReactNode;
  children: ReactNode;
  placement?: Placement;
  delay?: number;
  disabled?: boolean;
  className?: string;
}

export function Tooltip(props: TooltipProps) {
  const { content, children, placement = 'top', delay = 100, disabled = false, className } = props;
  const [visible, setVisible] = useState(false);
  const [position, setPosition] = useState({ top: 0, left: 0 });
  const triggerRef = useRef<HTMLSpanElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const timerRef = useRef<number>();

  const updatePosition = () => {
    if (!triggerRef.current || !tooltipRef.current) return;
    const triggerRect = triggerRef.current.getBoundingClientRect();
    const tooltipRect = tooltipRef.current.getBoundingClientRect();
    const gap = 8;

    let top = 0, left = 0;
    switch (placement) {
      case 'top':
        top = triggerRect.top - tooltipRect.height - gap;
        left = triggerRect.left + (triggerRect.width - tooltipRect.width) / 2;
        break;
      case 'bottom':
        top = triggerRect.bottom + gap;
        left = triggerRect.left + (triggerRect.width - tooltipRect.width) / 2;
        break;
      case 'left':
        top = triggerRect.top + (triggerRect.height - tooltipRect.height) / 2;
        left = triggerRect.left - tooltipRect.width - gap;
        break;
      case 'right':
        top = triggerRect.top + (triggerRect.height - tooltipRect.height) / 2;
        left = triggerRect.right + gap;
        break;
    }
    setPosition({ top: top + window.scrollY, left: left + window.scrollX });
  };

  useEffect(() => {
    if (visible) updatePosition();
  }, [visible]);

  const handleMouseEnter = () => {
    if (disabled) return;
    timerRef.current = window.setTimeout(() => setVisible(true), delay);
  };

  const handleMouseLeave = () => {
    clearTimeout(timerRef.current);
    setVisible(false);
  };

  return (
    <>
      <span ref={triggerRef} onMouseEnter={handleMouseEnter} onMouseLeave={handleMouseLeave} className="inline-block">
        {children}
      </span>
      {visible && (
        <Portal>
          <div
            ref={tooltipRef}
            className={cn(
              'absolute px-2.5 py-1.5 text-xs text-white bg-black/75 rounded z-[1000] pointer-events-none whitespace-nowrap',
              className
            )}
            style={{ top: position.top, left: position.left }}
          >
            {content}
          </div>
        </Portal>
      )}
    </>
  );
}
