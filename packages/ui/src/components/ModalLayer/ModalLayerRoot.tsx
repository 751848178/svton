import { useRef } from 'react';
import type { ReactNode, RefObject } from 'react';
import { useModalLayer } from '../../hooks/useModalLayer';

interface ModalLayerRootProps {
  children: ReactNode;
  closeOnEscape: boolean;
  kind: 'modal' | 'drawer';
  openerRef: RefObject<HTMLElement | null>;
  onClose: () => void;
  restoreFocusRef?: RefObject<HTMLElement | null>;
  restoreFocusSelector?: string;
}

/** Portal-mounted root that registers exactly one global modal layer. */
export function ModalLayerRoot({
  children,
  closeOnEscape,
  kind,
  openerRef,
  onClose,
  restoreFocusRef,
  restoreFocusSelector,
}: ModalLayerRootProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  useModalLayer(true, rootRef, {
    closeOnEscape,
    openerRef,
    onClose,
    restoreFocusRef,
    restoreFocusSelector,
  });
  return (
    <div
      ref={rootRef}
      className="fixed inset-0 z-[1000]"
      data-svton-modal-layer={kind}
    >
      {children}
    </div>
  );
}
