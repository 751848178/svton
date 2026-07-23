import React, { useRef, useEffect, useCallback, ReactNode } from 'react';
import { cn } from '../../lib/utils';
import { Portal } from '../Portal';
import { useOverlay } from '../../hooks/useOverlay';
import { useTransitionState } from '../../hooks/useTransitionState';

type Placement = 'left' | 'right' | 'top' | 'bottom';

const slideInMap: Record<Placement, string> = {
  left: 'anim-slide-in-left',
  right: 'anim-slide-in-right',
  top: 'anim-slide-in-top',
  bottom: 'anim-slide-in-bottom',
};

const slideOutMap: Record<Placement, string> = {
  left: 'anim-slide-out-left',
  right: 'anim-slide-out-right',
  top: 'anim-slide-out-top',
  bottom: 'anim-slide-out-bottom',
};

export interface DrawerProps {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
  title?: ReactNode;
  placement?: Placement;
  width?: number | string;
  height?: number | string;
  mask?: boolean;
  maskClosable?: boolean;
  className?: string;
}

export const Drawer = React.forwardRef<HTMLDivElement, DrawerProps>(function Drawer(props, ref) {
  const { open, onClose, children, title, placement = 'right', width = 300, height = 300, mask = true, maskClosable = true, className } = props;
  const panelRef = useRef<HTMLDivElement | null>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);

  const { state, ref: transitionRef } = useTransitionState(open, 250);

  const setPanelRef = useCallback((node: HTMLDivElement | null) => {
    (panelRef as React.MutableRefObject<HTMLDivElement | null>).current = node;
    transitionRef(node);
    if (typeof ref === 'function') {
      ref(node);
    } else if (ref) {
      (ref as React.MutableRefObject<HTMLDivElement | null>).current = node;
    }
  }, [ref, transitionRef]);

  useOverlay(state === 'visible' || state === 'entering', onClose);

  // Focus management
  useEffect(() => {
    if (state !== 'visible') return;
    previousFocusRef.current = document.activeElement as HTMLElement;
    const timer = setTimeout(() => panelRef.current?.focus(), 0);
    return () => {
      clearTimeout(timer);
      previousFocusRef.current?.focus();
    };
  }, [state]);

  if (state === 'closed') return null;

  const isHorizontal = placement === 'left' || placement === 'right';
  const maskAnim = state === 'entering' ? 'anim-fade-in' : state === 'exiting' ? 'anim-fade-out' : '';
  const panelAnim = state === 'entering' ? slideInMap[placement] : state === 'exiting' ? slideOutMap[placement] : '';

  return (
    <Portal>
      {mask && (
        <div
          onClick={maskClosable ? onClose : undefined}
          className={cn('fixed inset-0 bg-black/45 z-[1000] dark:bg-black/65', maskAnim)}
          aria-hidden="true"
        />
      )}
      <div
        className={cn(
          'fixed bg-popover text-popover-foreground shadow-xl flex flex-col z-[1001]',
          placement === 'left' && 'top-0 bottom-0 left-0',
          placement === 'right' && 'top-0 bottom-0 right-0',
          placement === 'top' && 'top-0 left-0 right-0',
          placement === 'bottom' && 'bottom-0 left-0 right-0',
          panelAnim,
          className
        )}
        style={isHorizontal ? { width } : { height }}
        ref={setPanelRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-label={typeof title === 'string' ? title : undefined}
      >
        {title && (
          <div className="px-6 py-4 border-b border-border flex items-center justify-between">
            <div className="text-base font-medium">{title}</div>
            <button onClick={onClose} className="p-1 text-lg text-muted-foreground hover:text-foreground" aria-label="Close">×</button>
          </div>
        )}
        <div className="flex-1 p-6 overflow-auto">{children}</div>
      </div>
    </Portal>
  );
});
