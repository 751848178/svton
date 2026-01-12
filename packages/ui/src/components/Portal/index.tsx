import { useEffect, useState, ReactNode } from 'react';
import { createPortal } from 'react-dom';

export interface PortalProps {
  children: ReactNode;
  container?: Element | null;
  disabled?: boolean;
}

export function Portal(props: PortalProps) {
  const { children, container, disabled = false } = props;
  const [mountNode, setMountNode] = useState<Element | null>(null);

  useEffect(() => {
    if (disabled) {
      setMountNode(null);
      return;
    }
    setMountNode(container ?? document.body);
  }, [container, disabled]);

  if (disabled || !mountNode) {
    return <>{children}</>;
  }

  return createPortal(children, mountNode);
}

export interface PortalContainerProps {
  children: ReactNode;
  id?: string;
  className?: string;
}

export function PortalContainer(props: PortalContainerProps) {
  const { children, id = 'portal-root', className } = props;
  const [container, setContainer] = useState<HTMLElement | null>(null);

  useEffect(() => {
    let el = document.getElementById(id);
    if (!el) {
      el = document.createElement('div');
      el.id = id;
      if (className) el.className = className;
      document.body.appendChild(el);
    }
    setContainer(el);
    return () => {
      if (el && el.parentNode && el.childNodes.length === 0) {
        el.parentNode.removeChild(el);
      }
    };
  }, [id, className]);

  if (!container) return null;

  return createPortal(children, container);
}
