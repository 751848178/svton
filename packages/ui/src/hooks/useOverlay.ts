import { useEffect } from 'react';

/**
 * Shared overlay behavior for Modal, Drawer, and similar components.
 * Handles body scroll lock and Escape key dismissal.
 */
export function useOverlay(open: boolean, onClose: () => void): void {
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
}
