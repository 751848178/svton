import { useLayoutEffect, type RefObject } from 'react';

type InertElement = HTMLElement & { inert: boolean };

/** Applies native inert while preserving a possible outer inert owner. */
export function useInert(ref: RefObject<HTMLElement | null>, active: boolean) {
  useLayoutEffect(() => {
    const element = ref.current as InertElement | null;
    if (!element || !active) return undefined;
    const previousInert = element.inert;
    const previousAttribute = element.getAttribute('inert');
    element.inert = true;
    element.setAttribute('inert', '');
    return () => {
      element.inert = previousInert;
      if (previousAttribute === null && !previousInert) element.removeAttribute('inert');
      else if (previousAttribute !== null) element.setAttribute('inert', previousAttribute);
    };
  }, [active, ref]);
}
