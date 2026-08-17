import React, { useId, useRef } from 'react';
import type { ReactNode, RefObject } from 'react';
import { CloseIcon } from '../../icons';
import { useTransitionState } from '../../hooks/useTransitionState';
import { cn } from '../../lib/utils';
import { DialogFocusPanel } from '../ModalLayer/DialogFocusPanel';
import { ModalLayerRoot } from '../ModalLayer/ModalLayerRoot';
import { Portal } from '../Portal';

export interface ModalProps {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
  title?: ReactNode;
  description?: ReactNode;
  footer?: ReactNode;
  width?: number | string;
  mask?: boolean;
  maskClosable?: boolean;
  closeOnEscape?: boolean;
  showCloseButton?: boolean;
  centered?: boolean;
  className?: string;
  bodyClassName?: string;
  footerClassName?: string;
  role?: 'dialog' | 'alertdialog';
  /** 关闭按钮的本地化 accessible name；缺省用英文 "Close"。 */
  ariaCloseLabel?: string;
  /** 指向由调用方持有的正文描述节点。 */
  ariaDescriptionId?: string;
  'aria-label'?: string;
  initialFocusRef?: RefObject<HTMLElement | null>;
  initialFocusSelector?: string;
  restoreFocusRef?: RefObject<HTMLElement | null>;
  restoreFocusSelector?: string;
  testId?: string;
}

export const Modal = React.forwardRef<HTMLDivElement, ModalProps>(function Modal(props, ref) {
  const {
    open, onClose, children, title, description, footer, width = 480,
    mask = true, maskClosable = true, closeOnEscape = true,
    showCloseButton = true, centered = true, className, bodyClassName,
    footerClassName, role = 'dialog', ariaCloseLabel = 'Close', ariaDescriptionId,
    initialFocusRef, initialFocusSelector, restoreFocusRef,
    restoreFocusSelector, testId,
  } = props;
  const openerRef = useRef<HTMLElement | null>(null);
  const previousOpenRef = useRef(false);
  if (open && !previousOpenRef.current && typeof document !== 'undefined') {
    openerRef.current = document.activeElement instanceof HTMLElement
      ? document.activeElement : null;
  }
  previousOpenRef.current = open;
  const titleId = useId();
  const descriptionId = useId();
  const { state, ref: transitionRef } = useTransitionState(open, 200);
  const active = state !== 'closed';
  if (!active) return null;
  const maskAnim = state === 'entering' ? 'anim-fade-in'
    : state === 'exiting' ? 'anim-fade-out' : '';
  const panelAnim = state === 'entering' ? 'anim-scale-in'
    : state === 'exiting' ? 'anim-scale-out' : '';
  return (
    <Portal>
      <ModalLayerRoot
        kind="modal"
        closeOnEscape={open && closeOnEscape}
        openerRef={openerRef}
        onClose={onClose}
        restoreFocusRef={restoreFocusRef}
        restoreFocusSelector={restoreFocusSelector}
      >
        {mask && <div onClick={maskClosable ? onClose : undefined} className={cn('absolute inset-0 bg-black/45 dark:bg-black/65', maskAnim)} aria-hidden="true" />}
        <div className={cn('absolute inset-0 flex justify-center pointer-events-none', centered ? 'items-center' : 'items-start pt-[100px]')}>
          <DialogFocusPanel
            ref={(node) => {
              transitionRef(node);
              if (typeof ref === 'function') ref(node);
              else if (ref) ref.current = node;
            }}
            active={state === 'visible'}
            initialFocusRef={initialFocusRef}
            initialFocusSelector={initialFocusSelector}
            tabIndex={-1}
            role={role}
            aria-modal="true"
            aria-label={props['aria-label']}
            aria-labelledby={title ? titleId : undefined}
            aria-describedby={ariaDescriptionId ?? (description ? descriptionId : undefined)}
            data-testid={testId}
            className={cn('max-w-[calc(100vw-32px)] max-h-[calc(100vh-64px)] bg-popover text-popover-foreground rounded-lg shadow-lg flex flex-col pointer-events-auto outline-none', panelAnim, className)}
            style={{ width }}
          >
            {title && <header className="px-6 py-4 border-b border-border flex items-start justify-between gap-4"><div><h2 id={titleId} className="text-base font-medium">{title}</h2>{description && <div id={descriptionId} className="mt-1 text-sm text-muted-foreground">{description}</div>}</div>{showCloseButton && <button type="button" onClick={onClose} className="inline-flex size-11 shrink-0 items-center justify-center rounded text-muted-foreground hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring" aria-label={ariaCloseLabel}><CloseIcon size={18} aria-hidden="true" /></button>}</header>}
            <div className={cn('flex-1 p-6 overflow-auto', bodyClassName)}>{children}</div>
            {footer !== undefined && <footer className={cn('px-6 py-3 border-t border-border flex justify-end gap-2', footerClassName)}>{footer}</footer>}
          </DialogFocusPanel>
        </div>
      </ModalLayerRoot>
    </Portal>
  );
});
