import React, { useId, useRef } from 'react';
import type { ReactNode, RefObject } from 'react';
import { CloseIcon } from '../../icons';
import { useTransitionState } from '../../hooks/useTransitionState';
import { cn } from '../../lib/utils';
import { DialogFocusPanel } from '../ModalLayer/DialogFocusPanel';
import { ModalLayerRoot } from '../ModalLayer/ModalLayerRoot';
import { Portal } from '../Portal';

type Placement = 'left' | 'right' | 'top' | 'bottom';
const slideIn: Record<Placement, string> = { left: 'anim-slide-in-left', right: 'anim-slide-in-right', top: 'anim-slide-in-top', bottom: 'anim-slide-in-bottom' };
const slideOut: Record<Placement, string> = { left: 'anim-slide-out-left', right: 'anim-slide-out-right', top: 'anim-slide-out-top', bottom: 'anim-slide-out-bottom' };

export interface DrawerProps {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
  title?: ReactNode;
  description?: ReactNode;
  placement?: Placement;
  width?: number | string;
  height?: number | string;
  mask?: boolean;
  maskClosable?: boolean;
  closeOnEscape?: boolean;
  showCloseButton?: boolean;
  className?: string;
  'aria-label'?: string;
  initialFocusRef?: RefObject<HTMLElement | null>;
  initialFocusSelector?: string;
  restoreFocusRef?: RefObject<HTMLElement | null>;
  restoreFocusSelector?: string;
}

export const Drawer = React.forwardRef<HTMLDivElement, DrawerProps>(function Drawer(props, ref) {
  const {
    open, onClose, children, title, description, placement = 'right', width = 300,
    height = 300, mask = true, maskClosable = true, closeOnEscape = true,
    showCloseButton = true, className, initialFocusRef, initialFocusSelector,
    restoreFocusRef, restoreFocusSelector,
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
  const { state, ref: transitionRef } = useTransitionState(open, 250);
  const active = state !== 'closed';
  if (!active) return null;
  const horizontal = placement === 'left' || placement === 'right';
  const maskAnim = state === 'entering' ? 'anim-fade-in' : state === 'exiting' ? 'anim-fade-out' : '';
  const panelAnim = state === 'entering' ? slideIn[placement] : state === 'exiting' ? slideOut[placement] : '';
  return (
    <Portal>
      <ModalLayerRoot
        kind="drawer"
        closeOnEscape={open && closeOnEscape}
        openerRef={openerRef}
        onClose={onClose}
        restoreFocusRef={restoreFocusRef}
        restoreFocusSelector={restoreFocusSelector}
      >
        {mask && <div onClick={maskClosable ? onClose : undefined} className={cn('absolute inset-0 bg-black/45 dark:bg-black/65', maskAnim)} aria-hidden="true" />}
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
          role="dialog"
          aria-modal="true"
          aria-label={props['aria-label']}
          aria-labelledby={title ? titleId : undefined}
          aria-describedby={description ? descriptionId : undefined}
          className={cn('absolute bg-popover text-popover-foreground shadow-xl flex flex-col outline-none', placement === 'left' && 'inset-y-0 left-0', placement === 'right' && 'inset-y-0 right-0', placement === 'top' && 'inset-x-0 top-0', placement === 'bottom' && 'inset-x-0 bottom-0', panelAnim, className)}
          style={horizontal ? { width } : { height }}
        >
          {title && <header className="px-6 py-4 border-b border-border flex items-start justify-between gap-4"><div><h2 id={titleId} className="text-base font-medium">{title}</h2>{description && <div id={descriptionId} className="mt-1 text-sm text-muted-foreground">{description}</div>}</div>{showCloseButton && <button type="button" onClick={onClose} className="inline-flex size-11 shrink-0 items-center justify-center rounded text-muted-foreground hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring" aria-label="Close"><CloseIcon size={18} aria-hidden="true" /></button>}</header>}
          <div className="flex-1 p-6 overflow-auto">{children}</div>
        </DialogFocusPanel>
      </ModalLayerRoot>
    </Portal>
  );
});
