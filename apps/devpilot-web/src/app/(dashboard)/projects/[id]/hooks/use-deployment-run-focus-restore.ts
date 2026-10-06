'use client';

import { useEffect, useRef, useState } from 'react';

export function useDeploymentRunFocusRestore(focusedRunId?: string) {
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const previousRunId = useRef(focusedRunId);
  const [selector, setSelector] = useState<string>();

  useEffect(() => {
    const previous = previousRunId.current;
    previousRunId.current = focusedRunId;
    if (!previous || focusedRunId || !selector) return undefined;
    const timer = window.setTimeout(() => {
      document.querySelector<HTMLElement>(selector)?.focus();
    }, 300);
    return () => window.clearTimeout(timer);
  }, [focusedRunId, selector]);

  const remember = (trigger: HTMLButtonElement) => {
    triggerRef.current = trigger;
    const key = trigger.dataset.deploymentRunTrigger;
    setSelector(key ? `[data-deployment-run-trigger=${JSON.stringify(key)}]` : undefined);
  };

  return { triggerRef, selector, remember };
}
