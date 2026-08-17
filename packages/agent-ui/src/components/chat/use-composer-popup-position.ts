import { useCallback, useLayoutEffect, useState, type RefObject } from 'react';

const VIEWPORT_GUTTER = 8;
const POPUP_GAP = 4;

export interface ComposerPopupPosition {
  left: number;
  top?: number;
  bottom?: number;
  width: number;
  maxHeight: number;
  placement: 'above' | 'below';
}

const INITIAL_POSITION: ComposerPopupPosition = {
  left: 0,
  bottom: 0,
  width: 0,
  maxHeight: 0,
  placement: 'above',
};

/** Owns fixed popup geometry relative to the real composer anchor and visual viewport. */
export function useComposerPopupPosition(
  anchorRef: RefObject<HTMLElement | null>,
  open: boolean,
  updateKey: string,
) {
  const [position, setPosition] = useState(INITIAL_POSITION);
  const update = useCallback(() => {
    const anchor = anchorRef.current;
    if (!anchor) return;
    const rect = anchor.getBoundingClientRect();
    const viewport = window.visualViewport;
    const viewportLeft = viewport?.offsetLeft ?? 0;
    const viewportTop = viewport?.offsetTop ?? 0;
    const viewportWidth = viewport?.width ?? window.innerWidth;
    const viewportHeight = viewport?.height ?? window.innerHeight;
    const viewportRight = viewportLeft + viewportWidth;
    const viewportBottom = viewportTop + viewportHeight;
    const width = Math.max(0, Math.min(rect.width, viewportWidth - VIEWPORT_GUTTER * 2));
    const left = Math.min(
      Math.max(rect.left, viewportLeft + VIEWPORT_GUTTER),
      Math.max(viewportLeft + VIEWPORT_GUTTER, viewportRight - width - VIEWPORT_GUTTER),
    );
    const above = Math.max(0, rect.top - viewportTop - POPUP_GAP - VIEWPORT_GUTTER);
    const below = Math.max(0, viewportBottom - rect.bottom - POPUP_GAP - VIEWPORT_GUTTER);
    const placement = above >= below ? 'above' : 'below';
    setPosition(placement === 'above' ? {
      left,
      bottom: Math.max(0, window.innerHeight - rect.top + POPUP_GAP),
      width,
      maxHeight: above,
      placement,
    } : {
      left,
      top: rect.bottom + POPUP_GAP,
      width,
      maxHeight: below,
      placement,
    });
  }, [anchorRef]);

  useLayoutEffect(() => {
    if (!open) return undefined;
    update();
    const anchor = anchorRef.current;
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(update);
    if (anchor) observer?.observe(anchor);
    window.addEventListener('resize', update);
    window.addEventListener('scroll', update, true);
    window.visualViewport?.addEventListener('resize', update);
    window.visualViewport?.addEventListener('scroll', update);
    return () => {
      observer?.disconnect();
      window.removeEventListener('resize', update);
      window.removeEventListener('scroll', update, true);
      window.visualViewport?.removeEventListener('resize', update);
      window.visualViewport?.removeEventListener('scroll', update);
    };
  }, [anchorRef, open, update, updateKey]);

  return position;
}
