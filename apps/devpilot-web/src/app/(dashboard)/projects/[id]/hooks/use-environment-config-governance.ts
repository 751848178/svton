'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { apiRequest } from '@/lib/api-client';
import type { ProjectEnvironment } from '../types';
import type {
  CreateEnvironmentConfigRevisionResult,
  EnvironmentConfigRevisionList,
  EnvironmentConfigResourceReference,
} from '../types/environment-config-revision.types';

type Policy = {
  id: string;
  name: string;
  enabled: boolean;
  effect: string;
  project?: { id: string } | null;
  environment?: { id: string } | null;
};

export type ConfigRevisionDraft = {
  secretReferenceIds: string[];
  resourceReferences: EnvironmentConfigResourceReference[];
  routeSnapshot: Record<string, unknown>;
  policyReferenceIds: string[];
  changeSummary?: string;
};

export function useEnvironmentConfigGovernance(
  environment: ProjectEnvironment,
  projectId: string,
  onSaved: (updated: ProjectEnvironment) => void,
) {
  const [data, setData] = useState<EnvironmentConfigRevisionList | null>(null);
  const [policies, setPolicies] = useState<Policy[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const currentConfigRevisionId = environment.currentConfigRevisionId;

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [revisionList, allPolicies] = await Promise.all([
        apiRequest<EnvironmentConfigRevisionList>(
          `GET:/project-environments/${environment.id}/config-revisions`,
        ),
        apiRequest<Policy[]>('GET:/control-access-policies'),
      ]);
      setData(revisionList);
      setPolicies(allPolicies.filter((policy) =>
        policy.enabled &&
        (!policy.project || policy.project.id === projectId) &&
        (!policy.environment || policy.environment.id === environment.id),
      ));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '加载配置修订失败');
    } finally {
      setLoading(false);
    }
  }, [environment.id, projectId]);

  useEffect(() => {
    // A sibling editor can advance the current revision without changing the
    // environment id, so this dependency intentionally refreshes the history.
    void currentConfigRevisionId;
    void load();
  }, [load, currentConfigRevisionId]);

  const current = useMemo(
    () => data?.revisions.find((revision) => revision.current) ?? data?.revisions[0] ?? null,
    [data],
  );

  const save = useCallback(async (draft: ConfigRevisionDraft) => {
    setSaving(true);
    setError('');
    try {
      const result = await apiRequest<CreateEnvironmentConfigRevisionResult>(
        `POST:/project-environments/${environment.id}/config-revisions`,
        {
          ...draft,
          resourceReferences: draft.resourceReferences.map((reference) => ({
            kind: reference.kind,
            id: reference.id,
            sharedEnvironmentIds: reference.sharedEnvironmentIds,
            risk: reference.risk,
            impact: reference.impact,
          })),
          expectedCurrentRevisionId: data?.currentConfigRevisionId || undefined,
        },
      );
      setData((previous) => ({
        environmentId: environment.id,
        currentConfigRevisionId: result.revision.id,
        revisions: [
          result.revision,
          ...(previous?.revisions ?? []).map((revision) => ({ ...revision, current: false })),
        ],
      }));
      onSaved({ ...environment, ...result.environment });
      return result;
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : '保存配置修订失败';
      setError(message);
      throw cause;
    } finally {
      setSaving(false);
    }
  }, [data?.currentConfigRevisionId, environment, onSaved]);

  return { data, current, policies, loading, saving, error, load, save };
}
