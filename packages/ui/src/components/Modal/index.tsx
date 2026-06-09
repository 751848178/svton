import React, { useRef, useEffect, useCallback, ReactNode } from 'react';
import { cn } from '../../lib/utils';
import { Portal } from '../Portal';
import { useOverlay } from '../../hooks/useOverlay';
import { useTransitionState } from '../../hooks/useTransitionState';

export interface ModalProps {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
  title?: ReactNode;
  footer?: ReactNode;
  width?: number | string;
  mask?: boolean;
  maskClosable?: boolean;
  centered?: boolean;
  className?: string;
}

export const Modal = React.forwardRef<HTMLDivElement, ModalProps>(function Modal(props, ref) {
  const { open, onClose, children, title, footer, width = 480, mask = true, maskClosable = true, centered = true, className } = props;
  const panelRef = useRef<HTMLDivElement | null>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);

  const { state, ref: transitionRef } = useTransitionState(open, 200);

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

  // Focus trap & restore
  useEffect(() => {
    if (state !== 'visible') return;

    previousFocusRef.current = document.activeElement as HTMLElement;

    const timer = setTimeout(() => {
      panelRef.current?.focus();
    }, 0);

    return () => {
      clearTimeout(timer);
      previousFocusRef.current?.focus();
    };
  }, [state]);

  // Focus trap: keep Tab within the modal
  useEffect(() => {
    if (state !== 'visible') return;

    const handleTab = (e: KeyboardEvent) => {
      if (e.key !== 'Tab' || !panelRef.current) return;

      const focusable = panelRef.current.querySelectorAll<HTMLElement>(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
      );
      if (focusable.length === 0) return;

      const first = focusable[0];
      const last = focusable[focusable.length - 1];

      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', handleTab);
    return () => document.removeEventListener('keydown', handleTab);
  }, [state]);

  if (state === 'closed') return null;

  const maskAnim = state === 'entering' ? 'anim-fade-in' : state === 'exiting' ? 'anim-fade-out' : '';
  const panelAnim = state === 'entering' ? 'anim-scale-in' : state === 'exiting' ? 'anim-scale-out' : '';

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
          'fixed inset-0 flex justify-center z-[1001] pointer-events-none',
          centered ? 'items-center' : 'items-start pt-[100px]'
        )}
        role="dialog"
        aria-modal="true"
        aria-label={typeof title === 'string' ? title : undefined}
      >
        <div
          ref={setPanelRef}
          tabIndex={-1}
          className={cn(
            'max-w-[calc(100vw-32px)] max-h-[calc(100vh-64px)] bg-white dark:bg-gray-800 rounded-lg shadow-lg flex flex-col pointer-events-auto outline-none',
            panelAnim,
            className
          )}
          style={{ width }}
        >
          {title && (
            <div className="px-6 py-4 border-b border-black/5 dark:border-white/10 flex items-center justify-between">
              <div className="text-base font-medium dark:text-gray-100">{title}</div>
              <button onClick={onClose} className="p-1 text-xl text-black/45 hover:text-black/70 dark:text-gray-400 dark:hover:text-gray-200 leading-none" aria-label="Close">×</button>
            </div>
          )}
          <div className="flex-1 p-6 overflow-auto">{children}</div>
          {footer !== undefined && (
            <div className="px-6 py-3 border-t border-black/5 flex justify-end gap-2">{footer}</div>
          )}
        </div>
      </div>
    </Portal>
  );
});
