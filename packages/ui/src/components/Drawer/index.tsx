import React, { useEffect, ReactNode } from 'react';
import { cn } from '../../lib/utils';
import { Portal } from '../Portal';

type Placement = 'left' | 'right' | 'top' | 'bottom';

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

export function Drawer(props: DrawerProps) {
  const { open, onClose, children, title, placement = 'right', width = 300, height = 300, mask = true, maskClosable = true, className } = props;

  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden';
      return () => { document.body.style.overflow = ''; };
    }
  }, [open]);

  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    if (open) document.addEventListener('keydown', handleEsc);
    return () => document.removeEventListener('keydown', handleEsc);
  }, [open, onClose]);

  if (!open) return null;

  const isHorizontal = placement === 'left' || placement === 'right';

  return (
    <Portal>
      {mask && (
        <div
          onClick={maskClosable ? onClose : undefined}
          className="fixed inset-0 bg-black/45 z-[1000]"
        />
      )}
      <div
        className={cn(
          'fixed bg-white shadow-xl flex flex-col z-[1001]',
          placement === 'left' && 'top-0 bottom-0 left-0',
          placement === 'right' && 'top-0 bottom-0 right-0',
          placement === 'top' && 'top-0 left-0 right-0',
          placement === 'bottom' && 'bottom-0 left-0 right-0',
          className
        )}
        style={isHorizontal ? { width } : { height }}
      >
        {title && (
          <div className="px-6 py-4 border-b border-black/5 flex items-center justify-between">
            <div className="text-base font-medium">{title}</div>
            <button onClick={onClose} className="p-1 text-lg text-black/45 hover:text-black/70">×</button>
          </div>
        )}
        <div className="flex-1 p-6 overflow-auto">{children}</div>
      </div>
    </Portal>
  );
}
