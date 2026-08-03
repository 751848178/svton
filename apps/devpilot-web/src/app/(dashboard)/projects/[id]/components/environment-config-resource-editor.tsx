'use client';

import { useMemo, useState } from 'react';
import { Button } from '@svton/ui';
import { useTranslations } from 'next-intl';
import type { Project, ProjectEnvironment } from '../types';
import type { EnvironmentConfigResourceReference } from '../types/environment-config-revision.types';

type Candidate = {
  key: string;
  id: string;
  kind: EnvironmentConfigResourceReference['kind'];
  name: string;
};

export function EnvironmentConfigResourceEditor({
  project,
  environment,
  value,
  onChange,
}: {
  project: Project;
  environment: ProjectEnvironment;
  value: EnvironmentConfigResourceReference[];
  onChange: (next: EnvironmentConfigResourceReference[]) => void;
}) {
  const t = useTranslations('projects');
  const [candidateKey, setCandidateKey] = useState('');
  const candidates = useMemo<Candidate[]>(() => [
    ...(project.managedResources ?? []).map((item) => ({
      key: `managed_resource:${item.id}`, id: item.id,
      kind: 'managed_resource' as const, name: item.name,
    })),
    ...(project.resourceInstances ?? []).map((item) => ({
      key: `resource_instance:${item.id}`, id: item.id,
      kind: 'resource_instance' as const, name: item.name,
    })),
    ...(project.sites ?? []).map((item) => ({
      key: `site:${item.id}`, id: item.id, kind: 'site' as const, name: item.name,
    })),
    ...(project.cdnConfigs ?? []).map((item) => ({
      key: `cdn_config:${item.id}`, id: item.id, kind: 'cdn_config' as const, name: item.name,
    })),
  ], [project]);

  const add = () => {
    const candidate = candidates.find((item) => item.key === candidateKey);
    if (!candidate || value.some((item) => item.id === candidate.id && item.kind === candidate.kind)) return;
    onChange([...value, {
      id: candidate.id,
      kind: candidate.kind,
      name: candidate.name,
      sharedEnvironmentIds: [environment.id],
      risk: 'low',
      impact: t('configResourceDefaultImpact'),
    }]);
    setCandidateKey('');
  };

  const update = (index: number, patch: Partial<EnvironmentConfigResourceReference>) => {
    onChange(value.map((item, itemIndex) => itemIndex === index ? { ...item, ...patch } : item));
  };

  const toggleEnvironment = (index: number, environmentId: string, checked: boolean) => {
    const item = value[index];
    const ids = checked
      ? [...new Set([...item.sharedEnvironmentIds, environmentId])]
      : item.sharedEnvironmentIds.filter((id) => id !== environmentId);
    update(index, {
      sharedEnvironmentIds: ids,
      risk: ids.length > 1 && item.risk === 'low' ? 'medium' : item.risk,
    });
  };

  return (
    <div className="space-y-2 rounded-md border p-3">
      <div className="text-xs font-medium">{t('configResourceReferences')}</div>
      <div className="flex gap-2">
        <select
          className="min-w-0 flex-1 rounded-md border bg-background px-2 py-1.5 text-xs"
          value={candidateKey}
          onChange={(event) => setCandidateKey(event.target.value)}
          aria-label={t('configResourceSelect')}
        >
          <option value="">{t('configResourceSelect')}</option>
          {candidates.map((item) => (
            <option key={item.key} value={item.key}>{item.name} · {item.kind}</option>
          ))}
        </select>
        <Button size="sm" variant="ghost" onClick={add} disabled={!candidateKey}>
          {t('configReferenceAdd')}
        </Button>
      </div>
      {value.length === 0 ? (
        <p className="text-xs text-muted-foreground">{t('configNoResourceReferences')}</p>
      ) : value.map((item, index) => (
        <div key={`${item.kind}:${item.id}`} className="space-y-2 rounded-md bg-muted/40 p-2 text-xs">
          <div className="flex items-center justify-between gap-2">
            <span className="font-medium">{item.name} · {item.kind}</span>
            <button type="button" className="text-destructive" onClick={() => onChange(value.filter((_, i) => i !== index))}>
              {t('configReferenceRemove')}
            </button>
          </div>
          <div className="flex flex-wrap gap-3">
            {(project.environments ?? []).filter((item) => item.status === 'active').map((candidate) => (
              <label key={candidate.id} className="flex items-center gap-1">
                <input
                  type="checkbox"
                  checked={item.sharedEnvironmentIds.includes(candidate.id)}
                  disabled={candidate.id === environment.id}
                  onChange={(event) => toggleEnvironment(index, candidate.id, event.target.checked)}
                />
                {candidate.name}
              </label>
            ))}
          </div>
          <div className="grid grid-cols-[110px_1fr] gap-2">
            <select
              className="rounded-md border bg-background px-2 py-1"
              value={item.risk}
              onChange={(event) => update(index, { risk: event.target.value as EnvironmentConfigResourceReference['risk'] })}
            >
              <option value="low">low</option><option value="medium">medium</option><option value="high">high</option>
            </select>
            <input
              className="rounded-md border bg-background px-2 py-1"
              value={item.impact}
              onChange={(event) => update(index, { impact: event.target.value })}
              placeholder={t('configResourceImpact')}
            />
          </div>
        </div>
      ))}
    </div>
  );
}
