'use client';

import { useEffect, useRef } from 'react';

export function useReleaseProductionFocusNormalizer(input: {
  requestedRunId?: string;
  found: boolean;
  loading: boolean;
  error: string;
  onClose: () => void;
}) {
  const normalized = useRef<string | null>(null);
  const { requestedRunId, found, loading, error, onClose } = input;
  useEffect(() => {
    if (!requestedRunId || found || error) {
      normalized.current = null;
      return;
    }
    if (!loading && normalized.current !== requestedRunId) {
      normalized.current = requestedRunId;
      onClose();
    }
  }, [error, found, loading, onClose, requestedRunId]);
}
