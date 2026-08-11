import { useEffect, useRef, useState } from 'react';

const stack: symbol[] = [];
const listeners = new Set<() => void>();
let bodyLockCount = 0;
let previousOverflow = '';

export function useOverlay(open: boolean, onClose: () => void) {
  const id = useRef(Symbol('overlay'));
  const [, render] = useState(0);

  useEffect(() => {
    const update = () => render((value) => value + 1);
    listeners.add(update);
    return () => { listeners.delete(update); };
  }, []);

  useEffect(() => {
    if (!open) return;
    stack.push(id.current);
    lockBody();
    notify();
    return () => {
      const index = stack.lastIndexOf(id.current);
      if (index >= 0) stack.splice(index, 1);
      unlockBody();
      notify();
    };
  }, [open]);

  const topmost = open && stack[stack.length - 1] === id.current;
  const layer = Math.max(0, stack.indexOf(id.current));

  useEffect(() => {
    if (!topmost) return;
    const handleEsc = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      event.preventDefault();
      event.stopPropagation();
      onClose();
    };
    document.addEventListener('keydown', handleEsc, true);
    return () => document.removeEventListener('keydown', handleEsc, true);
  }, [onClose, topmost]);

  return { topmost, zIndex: 1000 + layer * 10 };
}

function notify() { for (const listener of listeners) listener(); }

function lockBody() {
  if (bodyLockCount === 0) {
    previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
  }
  bodyLockCount += 1;
}

function unlockBody() {
  bodyLockCount = Math.max(0, bodyLockCount - 1);
  if (bodyLockCount === 0) document.body.style.overflow = previousOverflow;
}
