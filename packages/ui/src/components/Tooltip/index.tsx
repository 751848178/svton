import React, { useState, useRef, useCallback, ReactNode } from 'react';
import { cn } from '../../lib/utils';
import { Portal } from '../Portal';
import { useFloatingPosition, Placement } from '../../hooks/useFloatingPosition';
import { useTransitionState } from '../../hooks/useTransitionState';

export interface TooltipProps {
  content: ReactNode;
  children: ReactNode;
  placement?: Placement;
  delay?: number;
  disabled?: boolean;
  className?: string;
}

export const Tooltip = React.forwardRef<HTMLSpanElement, TooltipProps>(function Tooltip(props, ref) {
  const { content, children, placement = 'top', delay = 100, disabled = false, className } = props;
  const [open, setOpen] = useState(false);
  const timerRef = useRef<number>(undefined);

  const { position, triggerRef, floatingRef } = useFloatingPosition(open, placement);
  const { state } = useTransitionState(open, 150);

  const setTriggerRef = useCallback((node: HTMLSpanElement | null) => {
    (triggerRef as React.MutableRefObject<HTMLSpanElement | null>).current = node;
    if (typeof ref === 'function') {
      ref(node);
    } else if (ref) {
      (ref as React.MutableRefObject<HTMLSpanElement | null>).current = node;
    }
  }, [ref, triggerRef]);

  const handleMouseEnter = () => {
    if (disabled) return;
    timerRef.current = window.setTimeout(() => setOpen(true), delay);
  };

  const handleMouseLeave = () => {
    clearTimeout(timerRef.current);
    setOpen(false);
  };

  const anim = state === 'entering' ? 'anim-fade-in' : state === 'exiting' ? 'anim-fade-out' : '';

  return (
    <>
      <span ref={setTriggerRef} onMouseEnter={handleMouseEnter} onMouseLeave={handleMouseLeave} className="inline-block">
        {children}
      </span>
      {state !== 'closed' && (
        <Portal>
          <div
            ref={floatingRef}
            className={cn(
              'absolute px-2.5 py-1.5 text-xs text-white bg-black/75 rounded z-[1000] pointer-events-none whitespace-nowrap',
              anim,
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
});
