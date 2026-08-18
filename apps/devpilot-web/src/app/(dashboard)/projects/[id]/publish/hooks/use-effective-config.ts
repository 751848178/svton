/**
 * 生效配置数据 Hook（第 0 步）
 *
 * 单一职责：为向导第二步「确认配置」拼装 effective-config.model 的输入 ——
 * 最新配置修订（GET /project-environments/:id/config-revisions）、
 * 项目密钥列表（GET /projects/:pid）、资源实例与类型模板
 * （GET /resource-instances?projectId= + GET /resource-types，注入 KEY 提取
 * 与 use-resource-instance-injections 同源，收敛到共享纯函数 deriveTemplateKeys）。
 */

'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { apiRequest } from '@/lib/api-client';
import type { Project } from '../../types';
import type { EnvironmentConfigRevisionList } from '../../types/environment-config-revision.types';
import {
  buildEffectiveConfigSummary,
  deriveTemplateKeys,
  type EffectiveConfigSummary,
} from '../components/effective-config.model';

interface ResourceInstanceRow {
  id: string;
  resourceType?: { id?: string; key?: string; name?: string } | null;
}

interface ResourceTypeRow {
  id: string;
  envTemplate?: string | null;
}

export function useEffectiveConfig(projectId: string, environmentId: string | null) {
  const [summary, setSummary] = useState<EffectiveConfigSummary | null>(null);
  const [revisionId, setRevisionId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    if (!environmentId) {
      setSummary(null);
      setRevisionId(null);
      return;
    }
    setLoading(true);
    setError('');
    try {
      const [revisions, project, instances, types] = await Promise.all([
        apiRequest<EnvironmentConfigRevisionList>(
          `GET:/project-environments/${environmentId}/config-revisions`,
        ),
        apiRequest<Project>(`GET:/projects/${encodeURIComponent(projectId)}`),
        apiRequest<ResourceInstanceRow[]>(
          `GET:/resource-instances?projectId=${encodeURIComponent(projectId)}`,
        ),
        apiRequest<ResourceTypeRow[]>('GET:/resource-types'),
      ]);
      const revision =
        revisions.revisions.find((item) => item.current) ?? revisions.revisions[0] ?? null;
      setRevisionId(revision?.id ?? null);
      setSummary(
        buildEffectiveConfigSummary({
          plainVariables: revision?.plainVariables ?? {},
          secretReferences: revision?.secretReferences ?? [],
          configuredSecretIds: (project.secretKeys ?? []).map((key) => key.id),
          resourceInjections: buildResourceInjections(revision, instances, types),
        }),
      );
    } catch (caught) {
      setSummary(null);
      setError(caught instanceof Error ? caught.message : String(caught));
    } finally {
      setLoading(false);
    }
  }, [environmentId, projectId]);

  useEffect(() => {
    void load();
  }, [load]);

  /** 发布阻断只看冲突：密钥「不可见」是警告不阻断（M8：密钥值本就不可见）。 */
  const blocking = useMemo(
    () => Boolean(summary && summary.conflicts.length > 0),
    [summary],
  );

  return { summary, revisionId, loading, error, blocking, reload: load };
}

/** 当前修订的 resource_instance 引用 → 实例 → 类型模板 → 注入 KEY 行。 */
function buildResourceInjections(
  revision: EnvironmentConfigRevisionList['revisions'][number] | null,
  instances: ResourceInstanceRow[],
  types: ResourceTypeRow[],
) {
  if (!revision) return [];
  const templateByType = new Map(types.map((type) => [type.id, type.envTemplate ?? null]));
  const injections: Array<{ key: string; label: string }> = [];
  for (const reference of revision.resourceReferences) {
    if (reference.kind !== 'resource_instance') continue;
    const instance = instances.find((item) => item.id === reference.id);
    const envTemplate = instance?.resourceType?.id
      ? (templateByType.get(instance.resourceType.id) ?? null)
      : null;
    for (const key of deriveTemplateKeys(envTemplate)) {
      injections.push({ key, label: reference.name });
    }
  }
  return injections;
}
