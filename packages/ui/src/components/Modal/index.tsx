import React, { useRef, useEffect, useCallback, useId, ReactNode } from 'react';
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
  /** 关闭按钮的本地化 accessible name；缺省用英文 "Close"。 */
  ariaCloseLabel?: string;
  /** 指向正文描述节点，供辅助技术在标题之后朗读。 */
  ariaDescriptionId?: string;
}

export const Modal = React.forwardRef<HTMLDivElement, ModalProps>(function Modal(props, ref) {
  const { open, onClose, children, title, footer, width = 480, mask = true, maskClosable = true, centered = true, className, ariaCloseLabel = 'Close', ariaDescriptionId } = props;
  const panelRef = useRef<HTMLDivElement | null>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);
  const titleId = useId();

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
        aria-labelledby={title ? titleId : undefined}
        aria-describedby={ariaDescriptionId}
      >
        <div
          ref={setPanelRef}
          tabIndex={-1}
          className={cn(
            'max-w-[calc(100vw-32px)] max-h-[calc(100vh-64px)] bg-popover text-popover-foreground rounded-lg shadow-lg flex flex-col pointer-events-auto outline-none',
            panelAnim,
            className
          )}
          style={{ width }}
        >
          {title && (
            <div className="px-6 py-4 border-b border-border flex items-center justify-between">
              <div id={titleId} className="text-base font-medium">{title}</div>
              <button onClick={onClose} className="inline-flex min-h-11 min-w-11 items-center justify-center text-xl text-muted-foreground hover:text-foreground leading-none" aria-label={ariaCloseLabel}>×</button>
            </div>
          )}
          <div className="flex-1 p-6 overflow-auto">{children}</div>
          {footer !== undefined && (
            <div className="px-6 py-3 border-t border-border flex justify-end gap-2">{footer}</div>
          )}
        </div>
      </div>
    </Portal>
  );
});
