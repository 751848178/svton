'use client';

import { useCallback, useEffect, useState } from 'react';
import { apiRequest } from '@/lib/api-client';
import type { ReleaseDeliveryCompatibility } from '../types/release-delivery-compatibility.types';

export function useReleaseDeliveryCompatibility(projectId: string) {
  const [compatibility, setCompatibility] = useState<ReleaseDeliveryCompatibility | null>(null);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    if (!projectId) return;
    try {
      setCompatibility(await apiRequest<ReleaseDeliveryCompatibility>(
        `GET:/projects/${projectId}/delivery/compatibility`,
      ));
      setError('');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    }
  }, [projectId]);

  useEffect(() => { void load(); }, [load]);
  return { compatibility, error, load };
}
