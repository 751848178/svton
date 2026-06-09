import { useState, useEffect, useRef, useCallback } from 'react';

type TransitionState = 'closed' | 'entering' | 'visible' | 'exiting';

/**
 * Manages enter/exit animation states.
 *
 * - When `open` becomes true: closed → entering → visible (after one frame)
 * - When `open` becomes false: visible → exiting → closed (after timeoutMs)
 *
 * Returns the current state and a ref callback for detecting transitionend.
 */
export function useTransitionState(open: boolean, timeoutMs = 200): {
  state: TransitionState;
  ref: (node: HTMLElement | null) => void;
} {
  const [state, setState] = useState<TransitionState>(open ? 'visible' : 'closed');
  const nodeRef = useRef<HTMLElement | null>(null);
  const timerRef = useRef<number | undefined>(undefined);
  const mountedRef = useRef(false);

  // Track open changes
  const prevOpenRef = useRef(open);
  useEffect(() => {
    if (open === prevOpenRef.current) return;
    prevOpenRef.current = open;

    if (open) {
      // Opening: go to entering, then visible on next frame
      setState('entering');
      // Use rAF to ensure the entering class is painted before transitioning to visible
      timerRef.current = window.requestAnimationFrame(() => {
        timerRef.current = window.requestAnimationFrame(() => {
          if (mountedRef.current) setState('visible');
        });
      });
    } else {
      // Closing: go to exiting, then closed after timeout
      setState('exiting');
      timerRef.current = window.setTimeout(() => {
        if (mountedRef.current) setState('closed');
      }, timeoutMs);
    }

    return () => {
      if (timerRef.current !== undefined) {
        cancelAnimationFrame(timerRef.current);
        clearTimeout(timerRef.current);
      }
    };
  }, [open, timeoutMs]);

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  // Also listen for transitionend on the DOM node as a fallback
  const ref = useCallback((node: HTMLElement | null) => {
    nodeRef.current = node;
  }, []);

  return { state, ref };
}
