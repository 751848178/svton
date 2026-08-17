import { useCallback, useRef, useState } from 'react';
import type { RefObject } from 'react';
import type { SessionManagementController } from '@svton/agent-client';

export function useDesktopSessionUnarchive(
  actions: SessionManagementController,
  queryRef: RefObject<HTMLInputElement | null>,
) {
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [failedId, setFailedId] = useState<string | null>(null);
  const pendingRef = useRef<string | null>(null);
  const clearError = useCallback(() => setFailedId(null), []);
  const unarchive = useCallback(async (id: string) => {
    if (pendingRef.current) return;
    pendingRef.current = id;
    setPendingId(id);
    setFailedId(null);
    try {
      const result = await actions.unarchive(id);
      if (!result.ok) {
        setFailedId(id);
        return;
      }
      queryRef.current?.focus();
    } catch {
      setFailedId(id);
    } finally {
      pendingRef.current = null;
      setPendingId(null);
    }
  }, [actions, queryRef]);
  return { pendingId, failedId, clearError, unarchive };
}
