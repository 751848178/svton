import React, { useEffect, ReactNode } from 'react';
import { cn } from '../../lib/utils';
import { Portal } from '../Portal';

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

export function Modal(props: ModalProps) {
  const { open, onClose, children, title, footer, width = 480, mask = true, maskClosable = true, centered = true, className } = props;

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
          'fixed inset-0 flex justify-center z-[1001] pointer-events-none',
          centered ? 'items-center' : 'items-start pt-[100px]'
        )}
      >
        <div
          className={cn(
            'max-w-[calc(100vw-32px)] max-h-[calc(100vh-64px)] bg-white rounded-lg shadow-lg flex flex-col pointer-events-auto',
            className
          )}
          style={{ width }}
        >
          {title && (
            <div className="px-6 py-4 border-b border-black/5 flex items-center justify-between">
              <div className="text-base font-medium">{title}</div>
              <button onClick={onClose} className="p-1 text-xl text-black/45 hover:text-black/70 leading-none">×</button>
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
}
