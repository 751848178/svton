import { useState, useRef, useEffect } from 'react';

export type Placement = 'top' | 'bottom' | 'left' | 'right';

interface FloatingPositionResult {
  position: { top: number; left: number };
  triggerRef: React.RefObject<HTMLSpanElement>;
  floatingRef: React.RefObject<HTMLDivElement>;
}

/**
 * Shared positioning logic for floating elements (Tooltip, Popover, etc.).
 * Computes absolute coordinates relative to the trigger element.
 */
export function useFloatingPosition(
  visible: boolean,
  placement: Placement,
  gap = 8,
): FloatingPositionResult {
  const [position, setPosition] = useState({ top: 0, left: 0 });
  const triggerRef = useRef<HTMLSpanElement>(null!);
  const floatingRef = useRef<HTMLDivElement>(null!);

  useEffect(() => {
    if (!visible || !triggerRef.current || !floatingRef.current) return;

    const triggerRect = triggerRef.current.getBoundingClientRect();
    const floatingRect = floatingRef.current.getBoundingClientRect();

    let top = 0, left = 0;
    switch (placement) {
      case 'top':
        top = triggerRect.top - floatingRect.height - gap;
        left = triggerRect.left + (triggerRect.width - floatingRect.width) / 2;
        break;
      case 'bottom':
        top = triggerRect.bottom + gap;
        left = triggerRect.left + (triggerRect.width - floatingRect.width) / 2;
        break;
      case 'left':
        top = triggerRect.top + (triggerRect.height - floatingRect.height) / 2;
        left = triggerRect.left - floatingRect.width - gap;
        break;
      case 'right':
        top = triggerRect.top + (triggerRect.height - floatingRect.height) / 2;
        left = triggerRect.right + gap;
        break;
    }
    setPosition({ top: top + window.scrollY, left: left + window.scrollX });
  }, [visible, placement, gap]);

  return { position, triggerRef, floatingRef };
}
