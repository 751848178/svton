import { useState, useRef, useLayoutEffect, useCallback } from 'react';
import type { RefCallback, RefObject } from 'react';

export type Placement = 'top' | 'bottom' | 'left' | 'right';

interface FloatingPositionResult {
  position: { top: number; left: number };
  triggerRef: RefObject<HTMLSpanElement | null>;
  floatingRef: RefObject<HTMLDivElement | null>;
  setFloatingRef: RefCallback<HTMLDivElement>;
}

/**
 * Shared positioning logic for floating elements (Tooltip, Popover, etc.).
 * Measures after portal mounting and follows viewport/container movement.
 */
export function useFloatingPosition(
  visible: boolean,
  placement: Placement,
  gap = 8,
  strategy: 'absolute' | 'fixed' = 'absolute',
): FloatingPositionResult {
  const [position, setPosition] = useState({ top: 0, left: 0 });
  const triggerRef = useRef<HTMLSpanElement | null>(null);
  const floatingRef = useRef<HTMLDivElement | null>(null);
  const [floatingElement, setFloatingElement] = useState<HTMLDivElement | null>(null);
  const setFloatingRef = useCallback((node: HTMLDivElement | null) => {
    floatingRef.current = node;
    setFloatingElement(node);
  }, []);

  useLayoutEffect(() => {
    const trigger = triggerRef.current;
    if (!visible || !trigger || !floatingElement) return;
    const update = () => {
      const triggerRect = trigger.getBoundingClientRect();
      const floatingRect = floatingElement.getBoundingClientRect();
      const width = document.documentElement.clientWidth || window.innerWidth;
      const height = document.documentElement.clientHeight || window.innerHeight;
      const edge = 8;
      let top = triggerRect.top + (triggerRect.height - floatingRect.height) / 2;
      let left = triggerRect.left + (triggerRect.width - floatingRect.width) / 2;

      if (placement === 'top') {
        top = triggerRect.top - floatingRect.height - gap;
        if (top < edge && triggerRect.bottom + gap + floatingRect.height <= height - edge) top = triggerRect.bottom + gap;
      } else if (placement === 'bottom') {
        top = triggerRect.bottom + gap;
        if (top + floatingRect.height > height - edge && triggerRect.top - gap - floatingRect.height >= edge) top = triggerRect.top - gap - floatingRect.height;
      } else if (placement === 'left') {
        left = triggerRect.left - floatingRect.width - gap;
        if (left < edge && triggerRect.right + gap + floatingRect.width <= width - edge) left = triggerRect.right + gap;
      } else {
        left = triggerRect.right + gap;
        if (left + floatingRect.width > width - edge && triggerRect.left - gap - floatingRect.width >= edge) left = triggerRect.left - gap - floatingRect.width;
      }
      top = Math.max(edge, Math.min(top, height - floatingRect.height - edge));
      left = Math.max(edge, Math.min(left, width - floatingRect.width - edge));
      const next = { top: top + (strategy === 'absolute' ? window.scrollY : 0), left: left + (strategy === 'absolute' ? window.scrollX : 0) };
      setPosition(previous => previous.top === next.top && previous.left === next.left ? previous : next);
    };
    update();
    window.addEventListener('scroll', update, true);
    window.addEventListener('resize', update);
    const observer = typeof ResizeObserver === 'undefined' ? undefined : new ResizeObserver(update);
    observer?.observe(trigger);
    observer?.observe(floatingElement);
    return () => {
      window.removeEventListener('scroll', update, true);
      window.removeEventListener('resize', update);
      observer?.disconnect();
    };
  }, [visible, floatingElement, placement, gap, strategy]);

  return { position, triggerRef, floatingRef, setFloatingRef };
}
