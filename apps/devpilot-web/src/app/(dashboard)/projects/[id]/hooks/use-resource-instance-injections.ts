/**
 * 资源实例注入 KEY 派生（AC-SET-041）
 *
 * 单一职责：资源绑定生成的注入 KEY 名来自资源类型的 envTemplate（部署侧
 * 第一源）。项目详情 select 不含该字段，因此从 GET /resource-types 读取
 * 类型模板，按当前修订的 resource_instance 引用 + 实例（GET
 * /resource-instances?projectId=）联接派生。读取失败或无实例时诚实返回空。
 */

'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { apiRequest } from '@/lib/api-client';
import type { EnvironmentConfigResourceReference } from '../types/environment-config-revision.types';

export interface ResourceInjectionRow {
  key: string;
  label: string;
}

export function useResourceInstanceInjections(
  projectId: string,
  references: EnvironmentConfigResourceReference[] | undefined,
): ResourceInjectionRow[] {
  const [instances, setInstances] = useState<Array<{
    id: string;
    name: string;
    resourceType?: { id?: string; key?: string; name?: string };
  }>>([]);
  const [types, setTypes] = useState<Array<{
    id: string;
    key: string;
    name: string;
    envTemplate?: string | null;
  }>>([]);

  const load = useCallback(async () => {
    try {
      const [instanceRows, typeRows] = await Promise.all([
        apiRequest<unknown[]>(`GET:/resource-instances?projectId=${encodeURIComponent(projectId)}`),
        apiRequest<unknown[]>('GET:/resource-types'),
      ]);
      setInstances(instanceRows as never);
      setTypes(typeRows as never);
    } catch {
      setInstances([]);
      setTypes([]);
    }
  }, [projectId]);

  useEffect(() => {
    void load();
  }, [load]);

  return useMemo(() => {
    const typeById = new Map(types.map((type) => [type.id, type]));
    const out: ResourceInjectionRow[] = [];
    for (const reference of references ?? []) {
      if (reference.kind !== 'resource_instance') continue;
      const instance = instances.find((item) => item.id === reference.id);
      if (!instance) continue;
      const type = instance.resourceType?.id ? typeById.get(instance.resourceType.id) : undefined;
      for (const key of deriveTemplateKeys(type?.envTemplate)) {
        out.push({
          key,
          label: `${type?.name || instance.resourceType?.name || '?'} / ${instance.name}`,
        });
      }
    }
    return out;
  }, [instances, types, references]);
}

/** 从资源类型 envTemplate 提取会注入的 KEY 名（与部署注入第一源同源）。 */
function deriveTemplateKeys(envTemplate: string | null | undefined): string[] {
  if (!envTemplate) return [];
  const keys = new Set<string>();
  for (const raw of envTemplate.split('\n')) {
    const line = raw.trim();
    const eq = line.indexOf('=');
    if (eq <= 0) continue;
    const key = line.slice(0, eq).trim();
    if (/^[A-Z_][A-Z0-9_]*$/.test(key)) keys.add(key);
  }
  return Array.from(keys).sort();
}
