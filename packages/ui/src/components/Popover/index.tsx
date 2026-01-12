import React, { useState, useRef, useEffect, ReactNode } from 'react';
import { cn } from '../../lib/utils';
import { Portal } from '../Portal';

type Placement = 'top' | 'bottom' | 'left' | 'right';
type Trigger = 'click' | 'hover';

export interface PopoverProps {
  content: ReactNode;
  children: ReactNode;
  placement?: Placement;
  trigger?: Trigger;
  visible?: boolean;
  onVisibleChange?: (visible: boolean) => void;
  className?: string;
}

export function Popover(props: PopoverProps) {
  const { content, children, placement = 'bottom', trigger = 'click', visible: controlledVisible, onVisibleChange, className } = props;
  const [internalVisible, setInternalVisible] = useState(false);
  const visible = controlledVisible ?? internalVisible;
  const [position, setPosition] = useState({ top: 0, left: 0 });
  const triggerRef = useRef<HTMLSpanElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);

  const setVisible = (v: boolean) => {
    setInternalVisible(v);
    onVisibleChange?.(v);
  };

  const updatePosition = () => {
    if (!triggerRef.current || !popoverRef.current) return;
    const triggerRect = triggerRef.current.getBoundingClientRect();
    const popoverRect = popoverRef.current.getBoundingClientRect();
    const gap = 8;

    let top = 0, left = 0;
    switch (placement) {
      case 'top':
        top = triggerRect.top - popoverRect.height - gap;
        left = triggerRect.left + (triggerRect.width - popoverRect.width) / 2;
        break;
      case 'bottom':
        top = triggerRect.bottom + gap;
        left = triggerRect.left + (triggerRect.width - popoverRect.width) / 2;
        break;
      case 'left':
        top = triggerRect.top + (triggerRect.height - popoverRect.height) / 2;
        left = triggerRect.left - popoverRect.width - gap;
        break;
      case 'right':
        top = triggerRect.top + (triggerRect.height - popoverRect.height) / 2;
        left = triggerRect.right + gap;
        break;
    }
    setPosition({ top: top + window.scrollY, left: left + window.scrollX });
  };

  useEffect(() => {
    if (visible) updatePosition();
  }, [visible]);

  useEffect(() => {
    if (!visible || trigger !== 'click') return;
    const handleClickOutside = (e: MouseEvent) => {
      if (!triggerRef.current?.contains(e.target as Node) && !popoverRef.current?.contains(e.target as Node)) {
        setVisible(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [visible, trigger]);

  const handleClick = () => trigger === 'click' && setVisible(!visible);
  const handleMouseEnter = () => trigger === 'hover' && setVisible(true);
  const handleMouseLeave = () => trigger === 'hover' && setVisible(false);

  return (
    <>
      <span ref={triggerRef} onClick={handleClick} onMouseEnter={handleMouseEnter} onMouseLeave={handleMouseLeave} className="inline-block">
        {children}
      </span>
      {visible && (
        <Portal>
          <div
            ref={popoverRef}
            className={cn('absolute p-3 bg-white rounded-lg shadow-lg z-[1000]', className)}
            style={{ top: position.top, left: position.left }}
            onMouseEnter={handleMouseEnter}
            onMouseLeave={handleMouseLeave}
          >
            {content}
          </div>
        </Portal>
      )}
    </>
  );
}
