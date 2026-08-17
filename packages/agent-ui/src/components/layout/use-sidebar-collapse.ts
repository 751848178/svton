import { useCallback, useState } from 'react';

export function useSidebarCollapse(input: {
  controlled?: boolean;
  defaultCollapsed: boolean;
  storageKey: string | false;
  onChange?: (collapsed: boolean) => void;
}) {
  const [internal, setInternal] = useState(() => {
    if (!input.storageKey) return input.defaultCollapsed;
    try {
      return localStorage.getItem(input.storageKey) === 'true';
    } catch {
      return input.defaultCollapsed;
    }
  });
  const collapsed = input.controlled ?? internal;
  const toggle = useCallback(() => {
    const next = !collapsed;
    if (input.onChange) input.onChange(next);
    else {
      setInternal(next);
      if (input.storageKey) {
        try { localStorage.setItem(input.storageKey, String(next)); } catch { /* optional */ }
      }
    }
  }, [collapsed, input.onChange, input.storageKey]);
  return { collapsed, toggle };
}
