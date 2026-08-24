import React, { useState, useEffect, useCallback, useRef, ReactNode } from 'react';
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

/** hover 模式：从 trigger 移入浮层允许的宽限时间(ms) */
const HOVER_GRACE = 150;

export const Popover = React.forwardRef<HTMLSpanElement, PopoverProps>(function Popover(props, ref) {
  const {
    content,
    children,
    placement = 'bottom',
    trigger = 'click',
    visible: controlledVisible,
    onVisibleChange,
    className,
    triggerClassName,
  } = props;
  const [internalVisible, setInternalVisible] = useState(false);
  const visible = controlledVisible ?? internalVisible;

  const { position, triggerRef, floatingRef } = useFloatingPosition(visible, placement);

  const setTriggerRef = useCallback(
    (node: HTMLSpanElement | null) => {
      (triggerRef as React.MutableRefObject<HTMLSpanElement | null>).current = node;
      if (typeof ref === 'function') {
        ref(node);
      } else if (ref) {
        (ref as React.MutableRefObject<HTMLSpanElement | null>).current = node;
      }
    },
    [ref, triggerRef],
  );

  const setVisible = useCallback(
    (v: boolean) => {
      setInternalVisible(v);
      onVisibleChange?.(v);
    },
    [onVisibleChange],
  );

  const graceTimer = useRef<number | undefined>(undefined);
  const leaveGrace = useCallback(() => {
    clearTimeout(graceTimer.current);
    graceTimer.current = window.setTimeout(() => setVisible(false), HOVER_GRACE);
  }, [setVisible]);
  const cancelLeaveGrace = useCallback(() => {
    clearTimeout(graceTimer.current);
  }, []);

  useEffect(() => {
    if (!visible) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setVisible(false);
    };
    document.addEventListener('keydown', handleKeyDown);
    let cleanupOutside: (() => void) | undefined;
    if (trigger === 'click') {
      const handleClickOutside = (e: MouseEvent) => {
        if (
          !triggerRef.current?.contains(e.target as Node) &&
          !floatingRef.current?.contains(e.target as Node)
        ) {
          setVisible(false);
        }
      };
      document.addEventListener('mousedown', handleClickOutside);
      cleanupOutside = () => document.removeEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      cleanupOutside?.();
    };
  }, [visible, trigger, setVisible]);

  const handleClick = () => trigger === 'click' && setVisible(!visible);
  const handleMouseEnter = () => {
    if (trigger !== 'hover') return;
    cancelLeaveGrace();
    setVisible(true);
  };
  const handleMouseLeave = () => {
    if (trigger !== 'hover') return;
    leaveGrace();
  };

  return (
    <>
      <span
        ref={setTriggerRef}
        onClick={handleClick}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        className={cn('inline-block', triggerClassName)}
      >
        {children}
      </span>
      {visible && (
        <Portal>
          <div
            ref={floatingRef}
            className={cn(
              'absolute z-[1000] rounded-lg border border-border bg-popover p-3 text-popover-foreground shadow-lg',
              className,
            )}
            style={{ top: position.top, left: position.left }}
            role="dialog"
            aria-hidden="false"
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
