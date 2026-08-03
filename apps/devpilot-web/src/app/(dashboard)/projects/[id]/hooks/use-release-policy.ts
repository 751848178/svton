'use client';

import { useCallback, useEffect, useState } from 'react';
import { apiRequest } from '@/lib/api-client';
import type { ReleasePolicyResponse } from '../types/release-policy.types';

export function useReleasePolicy(projectId: string) {
  const [policy, setPolicy] = useState<ReleasePolicyResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    if (!projectId) return;
    setLoading(true);
    try {
      setPolicy(await apiRequest<ReleasePolicyResponse>(`GET:/projects/${projectId}/release-policy`));
      setError('');
    } catch (cause) {
      setError(message(cause));
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => { void load(); }, [load]);

  const saveStandard = useCallback(async () => {
    if (!policy) return;
    setSaving(true);
    try {
      const body: Record<string, unknown> = {
        strategy: 'standard',
        requireProductionApproval: true,
      };
      if (policy.current.id) body.expectedCurrentRevisionId = policy.current.id;
      setPolicy(await apiRequest<ReleasePolicyResponse>(
        `POST:/projects/${projectId}/release-policy`,
        body,
      ));
      setError('');
    } catch (cause) {
      setError(message(cause));
    } finally {
      setSaving(false);
    }
  }, [policy, projectId]);

  return { policy, loading, saving, error, load, saveStandard };
}

function message(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

