'use client';

/**
 * 项目组件名映射（单一职责：applicationId → 展示名）。
 * 供制品证据把 componentKey cuid 翻译成人能看懂的组件名；失败时静默回退短 ID。
 */
import { useEffect, useState } from 'react';
import { apiRequest } from '@/lib/api-client';
import { useAuthStore, useTeamStore } from '@/store/hooks';

export function useProjectComponentNames(projectId: string, enabled: boolean) {
  const actorId = useAuthStore().user?.id ?? null;
  const teamId = useTeamStore().currentTeam?.id ?? null;
  const active = enabled && Boolean(actorId && teamId);
  const [names, setNames] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!active) return;
    let current = true;
    void apiRequest<Array<{ id: string; name: string }>>('GET:/applications', { projectId })
      .then((items) => {
        if (!current) return;
        setNames(Object.fromEntries(items.map((item) => [item.id, item.name])));
      })
      .catch(() => {
        if (current) setNames({});
      });
    return () => {
      current = false;
    };
  }, [active, projectId]);

  return names;
}
