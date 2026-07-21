import React, { useState, useEffect, useCallback, ReactNode } from 'react';
import { cn } from '../../lib/utils';
import { Portal } from '../Portal';
import { useFloatingPosition, Placement } from '../../hooks/useFloatingPosition';

type Trigger = 'click' | 'hover';

export interface PopoverProps {
  content: ReactNode;
  children: ReactNode;
  placement?: Placement;
  trigger?: Trigger;
  visible?: boolean;
  onVisibleChange?: (visible: boolean) => void;
  className?: string;
  /**
   * 额外 class,合并到 trigger 包裹 span(默认 `inline-block`)。
   * 通过 twMerge 合并,后值优先 —— 例如传 `block w-full` 可让 trigger 撑满父容器。
   */
  triggerClassName?: string;
}

export const Popover = React.forwardRef<HTMLSpanElement, PopoverProps>(function Popover(props, ref) {
  const { content, children, placement = 'bottom', trigger = 'click', visible: controlledVisible, onVisibleChange, className, triggerClassName } = props;
  const [internalVisible, setInternalVisible] = useState(false);
  const visible = controlledVisible ?? internalVisible;

  const { position, triggerRef, floatingRef } = useFloatingPosition(visible, placement);

  const setTriggerRef = useCallback((node: HTMLSpanElement | null) => {
    (triggerRef as React.MutableRefObject<HTMLSpanElement | null>).current = node;
    if (typeof ref === 'function') {
      ref(node);
    } else if (ref) {
      (ref as React.MutableRefObject<HTMLSpanElement | null>).current = node;
    }
  }, [ref, triggerRef]);

  const setVisible = (v: boolean) => {
    setInternalVisible(v);
    onVisibleChange?.(v);
  };

  useEffect(() => {
    if (!visible || trigger !== 'click') return;
    const handleClickOutside = (e: MouseEvent) => {
      if (!triggerRef.current?.contains(e.target as Node) && !floatingRef.current?.contains(e.target as Node)) {
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
      <span ref={setTriggerRef} onClick={handleClick} onMouseEnter={handleMouseEnter} onMouseLeave={handleMouseLeave} className={cn('inline-block', triggerClassName)}>
        {children}
      </span>
      {visible && (
        <Portal>
          <div
            ref={floatingRef}
            className={cn('absolute p-3 bg-white dark:bg-gray-800 rounded-lg shadow-lg z-[1000]', className)}
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
});
