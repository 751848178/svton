import { useSyncExternalStore } from 'react';

export type ResponsiveBand = 'compact' | 'medium' | 'wide';

function bandForWidth(width: number): ResponsiveBand {
  if (width < 640) return 'compact';
  if (width < 1024) return 'medium';
  return 'wide';
}

function readBand(): ResponsiveBand {
  return bandForWidth(window.innerWidth);
}

/** Functional viewport band shared by AgentShell, Web, and Desktop hosts. */
export function useResponsiveBand(): ResponsiveBand {
  return useSyncExternalStore((onChange) => {
    window.addEventListener('resize', onChange);
    window.visualViewport?.addEventListener('resize', onChange);
    return () => {
      window.removeEventListener('resize', onChange);
      window.visualViewport?.removeEventListener('resize', onChange);
    };
  }, readBand, () => 'compact');
}
