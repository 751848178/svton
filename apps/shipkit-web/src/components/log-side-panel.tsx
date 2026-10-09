'use client';
import { useEffect, useId, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';

// A complementary panel deliberately has no modal layer, backdrop or focus trap.
export function LogSidePanel({ title, navigation, onClose, children }: { title: string; navigation?: ReactNode; onClose: () => void; children: ReactNode }) {
  const [mounted, setMounted] = useState(false);
  const panel = useRef<HTMLElement>(null);
  const close = useRef(onClose);
  close.current = onClose;
  const titleId = useId();
  useEffect(() => {
    setMounted(true);
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const escape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape' || event.defaultPrevented || event.isComposing) return;
      // The first Escape belongs to an open Select, including its portal.
      if (panel.current?.querySelector('[role="combobox"][aria-expanded="true"]')) return;
      close.current();
    };
    document.addEventListener('keydown', escape);
    return () => {
      document.removeEventListener('keydown', escape);
      if (panel.current?.contains(document.activeElement) && opener?.isConnected) opener.focus({ preventScroll: true });
    };
  }, []);
  if (!mounted) return null;
  return createPortal(<aside className="log-side-panel" ref={panel} aria-labelledby={titleId}>
    <header className="log-panel-head"><div><h2 id={titleId}>{title}</h2><p>点击页面中的其他阶段，可直接切换日志。</p></div><button type="button" className="log-panel-close" onClick={onClose} aria-label="关闭步骤日志"><X size={20} aria-hidden="true" /></button></header>
    {navigation && <div className="log-panel-navigation">{navigation}</div>}
    <div className="log-panel-body">{children}</div>
  </aside>, document.body);
}
