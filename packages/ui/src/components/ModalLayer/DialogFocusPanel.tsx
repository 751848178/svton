import React, { useRef } from 'react';
import type { HTMLAttributes, RefObject } from 'react';
import { useDialogFocus } from '../../hooks/useDialogFocus';

interface DialogFocusPanelProps extends HTMLAttributes<HTMLDivElement> {
  active: boolean;
  initialFocusRef?: RefObject<HTMLElement | null>;
  initialFocusSelector?: string;
}

/** Portal-mounted panel that owns the shared initial-focus and Tab algorithm. */
export const DialogFocusPanel = React.forwardRef<HTMLDivElement, DialogFocusPanelProps>(
  function DialogFocusPanel({
    active,
    initialFocusRef,
    initialFocusSelector,
    onKeyDown,
    ...props
  }, forwardedRef) {
    const panelRef = useRef<HTMLDivElement>(null);
    const focusKeyDown = useDialogFocus(panelRef, {
      enabled: active,
      initialFocusRef,
      initialFocusSelector,
      restoreFocus: false,
      trapFocus: true,
    });
    return (
      <div
        {...props}
        ref={(node) => {
          panelRef.current = node;
          if (typeof forwardedRef === 'function') forwardedRef(node);
          else if (forwardedRef) forwardedRef.current = node;
        }}
        onKeyDown={(event) => {
          focusKeyDown(event);
          onKeyDown?.(event);
        }}
      />
    );
  },
);
