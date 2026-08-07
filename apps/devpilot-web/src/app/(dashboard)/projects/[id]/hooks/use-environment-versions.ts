'use client';

import { useCallback, useEffect, useState } from 'react';
import { apiRequest } from '@/lib/api-client';
import type {
  EnvironmentVersionActionResult,
  EnvironmentVersionsResponse,
} from '../types/environment-version.types';

export function useEnvironmentVersions(projectId: string) {
  const [data, setData] = useState<EnvironmentVersionsResponse>({
    environments: [],
    candidates: { staging: [], production: [] },
  });
  const [loading, setLoading] = useState(true);
  const [executing, setExecuting] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setData(
        await apiRequest<EnvironmentVersionsResponse>(
          `GET:/projects/${projectId}/delivery/environment-versions`,
        ),
      );
      setError('');
    } catch (caught) {
      setError(message(caught));
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    void load();
  }, [load]);

  const execute = useCallback(
    async (
      environmentId: string,
      input: {
        kind: 'upgrade' | 'recovery';
        manifestId?: string;
        sourceVersionId?: string;
        releaseRunId?: string;
      },
    ) => {
      setExecuting(true);
      setError('');
      try {
        const result = await apiRequest<EnvironmentVersionActionResult>(
          `POST:/projects/${projectId}/delivery/environment-versions/${environmentId}/actions`,
          input,
        );
        await load();
        return result;
      } catch (caught) {
        setError(message(caught));
        return null;
      } finally {
        setExecuting(false);
      }
    },
    [load, projectId],
  );

  return { ...data, loading, executing, error, load, execute };
}

function message(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}
