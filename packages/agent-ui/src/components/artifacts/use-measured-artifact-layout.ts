import { useCallback, useLayoutEffect, useState, type RefObject } from 'react';
import { useResponsiveBand } from '../layout/use-responsive-band';

export const MIN_CHAT_PANE_WIDTH = 520;
export const MIN_ARTIFACT_PANE_WIDTH = 420;
export const ARTIFACT_DIVIDER_WIDTH = 1;
export const MIN_ARTIFACT_SPLIT_WIDTH = MIN_CHAT_PANE_WIDTH
  + MIN_ARTIFACT_PANE_WIDTH
  + ARTIFACT_DIVIDER_WIDTH;

/** Converts viewport capability plus measured host width into one layout decision. */
export function useMeasuredArtifactLayout(ref: RefObject<HTMLElement | null>) {
  const band = useResponsiveBand();
  const [width, setWidth] = useState(0);
  const measure = useCallback(() => {
    const next = ref.current?.getBoundingClientRect().width ?? 0;
    setWidth((current) => current === next ? current : next);
  }, [ref]);

  useLayoutEffect(() => {
    const host = ref.current;
    if (!host) return undefined;
    measure();
    const observer = typeof ResizeObserver === 'undefined'
      ? null
      : new ResizeObserver((entries) => {
        const next = entries[0]?.contentRect.width;
        if (next === undefined) measure();
        else setWidth((current) => current === next ? current : next);
      });
    observer?.observe(host);
    window.addEventListener('resize', measure);
    return () => {
      observer?.disconnect();
      window.removeEventListener('resize', measure);
    };
  }, [measure, ref]);

  return {
    band,
    width,
    canSplit: band === 'wide' && width >= MIN_ARTIFACT_SPLIT_WIDTH,
  };
}
