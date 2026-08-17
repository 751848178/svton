import { useEffect, type MutableRefObject, type RefObject } from 'react';

/** Keeps an auto-following transcript bottom-pinned while its layout reflows. */
export function usePinnedTranscriptScroll(
  scrollRef: RefObject<HTMLElement | null>,
  userScrolledUp: MutableRefObject<boolean>,
  enabled = true,
) {
  useEffect(() => {
    const element = scrollRef.current;
    if (!enabled || !element || typeof ResizeObserver === 'undefined') return undefined;
    const observer = new ResizeObserver(() => {
      if (!userScrolledUp.current) element.scrollTop = element.scrollHeight;
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, [enabled, scrollRef, userScrolledUp]);
}
