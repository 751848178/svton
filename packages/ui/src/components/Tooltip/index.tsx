import React, { useState, useRef, useId, useCallback, ReactNode } from 'react';
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

function withDescribedBy(child: ReactNode, describedBy: string | undefined): ReactNode {
  // 读屏关联必须落在「可获得焦点的触发元素」上；wrapper 仅承接事件。
  if (describedBy === undefined) return child;
  if (React.isValidElement<{ 'aria-describedby'?: string }>(child)) {
    const existing = child.props['aria-describedby'];
    const next = existing ? `${existing} ${describedBy}` : describedBy;
    return React.cloneElement(child, { 'aria-describedby': next });
  }
  return child;
}

export const Tooltip = React.forwardRef<HTMLSpanElement, TooltipProps>(function Tooltip(props, ref) {
  const { content, children, placement = 'top', delay = 100, disabled = false, className } = props;
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const [escaped, setEscaped] = useState(false);
  const open = !disabled && (hovered || focused) && !escaped;
  const timerRef = useRef<number>(undefined);
  const id = useId();
  const visibleAt = open ? id : undefined;

  const { position, triggerRef, floatingRef } = useFloatingPosition(open, placement);
  const { state } = useTransitionState(open, 150);

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

  const handleMouseEnter = () => {
    if (disabled) return;
    setEscaped(false);
    timerRef.current = window.setTimeout(() => setHovered(true), delay);
  };

  const handleMouseLeave = () => {
    clearTimeout(timerRef.current);
    setHovered(false);
  };

  const handleFocus = () => {
    if (disabled) return;
    setEscaped(false);
    setFocused(true);
  };

  const handleBlur = (e: React.FocusEvent) => {
    if (e.currentTarget.contains(e.relatedTarget as Node)) return;
    setFocused(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      setEscaped(true);
      setHovered(false);
      setFocused(false);
    }
  };

  const anim = state === 'entering' ? 'anim-fade-in' : state === 'exiting' ? 'anim-fade-out' : '';

  return (
    <>
      <span
        ref={setTriggerRef}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        onFocus={handleFocus}
        onBlur={handleBlur}
        onKeyDown={handleKeyDown}
        className="inline-block"
      >
        {withDescribedBy(children, visibleAt)}
      </span>
      {state !== 'closed' && (
        <Portal>
          <div
            ref={floatingRef}
            id={id}
            role="tooltip"
            className={cn(
              'absolute z-[1000] max-w-xs rounded-md border border-border px-2.5 py-1.5 text-xs text-tooltip-foreground bg-tooltip pointer-events-none whitespace-nowrap shadow-lg',
              anim,
              className,
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
