/**
 * 资源引用编辑器（AC-SET-026 写侧）
 *
 * 单一职责：为当前草稿新增资源引用（绑定已有实例/使用允许共享的实例），
 * 并委托 RowControls 完成逐行的 绑定方式/共享与隔离 编辑；变更写回共享草稿，
 * 由修订化保存提交。创建/释放资源不属于项目页（AC-SET-027）。
 */
'use client';

import React, { useMemo, useState } from 'react';
import { Button } from '@svton/ui';
import { useTranslations } from 'next-intl';
import { Select } from '@/components/ui';
import type { Project, ProjectEnvironment } from '../types';
import type { EnvironmentConfigResourceReference } from '../types/environment-config-revision.types';
import { isProductionEnvironment } from './environment-resource-binding.model';
import { EnvironmentResourceBindingRowControls } from './environment-resource-binding-row-controls';
import { SettingsResourceBindingPreview } from './settings/settings-resource-binding-preview';
import { buildResourceBindingPreview } from './settings/settings-resource-binding-preview.model';
import { SettingsLegacyResourceBindingRepair } from './settings/settings-legacy-resource-binding-repair';

type Candidate = {
  key: string;
  id: string;
  kind: EnvironmentConfigResourceReference['kind'];
  name: string;
  resourceType?: { envTemplate?: string | null } | null;
};

export function EnvironmentConfigResourceEditor({
  project,
  environment,
  value,
  onChange,
  currentReferences,
}: {
  project: Project;
  environment: ProjectEnvironment;
  value: EnvironmentConfigResourceReference[];
  onChange: (next: EnvironmentConfigResourceReference[]) => void;
  currentReferences: EnvironmentConfigResourceReference[];
}) {
  const t = useTranslations('projects');
  const [candidateKey, setCandidateKey] = useState('');
  const [componentKey, setComponentKey] = useState('');
  const [envBindings, setEnvBindings] = useState<EnvironmentConfigResourceReference['envBindings']>();
  const [confirmed, setConfirmed] = useState(false);
  const production = isProductionEnvironment(environment);
  const candidates = useMemo<Candidate[]>(() => [
    ...(project.managedResources ?? []).map((item) => ({
      key: `managed_resource:${item.id}`, id: item.id,
      kind: 'managed_resource' as const, name: item.name,
    })),
    ...(project.resourceInstances ?? []).map((item) => ({
      key: `resource_instance:${item.id}`, id: item.id,
      kind: 'resource_instance' as const, name: item.name, resourceType: item.resourceType,
    })),
    ...(project.sites ?? []).map((item) => ({
      key: `site:${item.id}`, id: item.id, kind: 'site' as const, name: item.name,
    })),
    ...(project.cdnConfigs ?? []).map((item) => ({
      key: `cdn_config:${item.id}`, id: item.id, kind: 'cdn_config' as const, name: item.name,
    })),
  ], [project]);
  const components = useMemo(() => {
    const rows = (project.applications ?? []).flatMap((application) =>
      application.services
        .filter((service) => service.status === 'active' && service.environment?.id === environment.id)
        .map((service) => ({ key: service.id, label: `${application.name} · ${service.name}` })));
    return rows.filter((row, index) => rows.findIndex((item) => item.key === row.key) === index);
  }, [environment.id, project.applications]);
  const selected = candidates.find((item) => item.key === candidateKey);
  const preview = selected
    ? buildResourceBindingPreview(selected, componentKey || null, currentReferences, envBindings)
    : null;
  // 无模板变量的资源（如 site）没有可确认的映射，确认步骤无意义，直接视为已确认。
  const mappingsConfirmed = confirmed || !preview || preview.envBindings.length === 0;
  const addDisabledReason = !candidateKey
    ? t('configResourceAddMissingResource')
    : !componentKey
      ? t('configResourceAddMissingComponent')
      : !mappingsConfirmed
        ? t('configResourceAddUnconfirmed')
        : '';

  const add = () => {
    const candidate = candidates.find((item) => item.key === candidateKey);
    if (!candidate || !componentKey || !mappingsConfirmed || !envBindings ||
      value.some((item) => item.id === candidate.id && item.kind === candidate.kind)) return;
    onChange([...value, {
      id: candidate.id,
      kind: candidate.kind,
      name: candidate.name,
      sharedEnvironmentIds: [environment.id],
      risk: production ? 'high' : 'low',
      impact: t('configResourceDefaultImpact'),
      componentKey,
      envBindings,
    }]);
    setCandidateKey('');
    setComponentKey('');
    setEnvBindings(undefined);
    setConfirmed(false);
  };

  return (
    <div className="space-y-2 rounded-md border p-3">
      <div className="text-xs font-medium">{t('configResourceReferences')}</div>
      <div className="flex flex-wrap items-center gap-2">
        <Select
          size="sm"
          className="min-w-0 flex-1 bg-background"
          value={candidateKey}
          onChange={(event) => {
            const next = candidates.find((item) => item.key === event.target.value);
            setCandidateKey(event.target.value);
            setComponentKey('');
            setEnvBindings(next ? buildResourceBindingPreview(next, null, []).envBindings : undefined);
            setConfirmed(false);
          }}
          aria-label={t('configResourceSelect')}
        >
          <option value="">{t('configResourceSelect')}</option>
          {candidates.map((item) => (
            <option key={item.key} value={item.key}>{item.name} · {item.kind}</option>
          ))}
        </Select>
        <Button size="sm" variant="ghost" onClick={add} disabled={Boolean(addDisabledReason)}>
          {t('configReferenceAdd')}
        </Button>
      </div>
      {addDisabledReason ? (
        <p className="text-[11px] text-muted-foreground">{addDisabledReason}</p>
      ) : null}
      {components.length === 0 ? (
        <p className="rounded bg-amber-50 px-2 py-1 text-[11px] text-amber-800">
          {t('configResourceNoComponents')}
        </p>
      ) : null}
      {preview ? (
        <SettingsResourceBindingPreview
          preview={preview}
          components={components}
          onComponentChange={(next) => { setComponentKey(next); setConfirmed(false); }}
          onTargetChange={(sourceKey, targetEnvKey) => {
            setEnvBindings((current) => current?.map((binding) =>
              binding.sourceKey === sourceKey ? { ...binding, targetEnvKey } : binding));
            setConfirmed(false);
          }}
          confirmed={confirmed}
          onConfirm={preview.envBindings.length > 0 ? () => setConfirmed(true) : undefined}
        />
      ) : null}
      {value.flatMap((reference) => {
        if (reference.componentKey && Array.isArray(reference.envBindings)) return [];
        const candidate = candidates.find((item) =>
          item.id === reference.id && item.kind === reference.kind);
        if (!candidate) return [];
        return [(
          <SettingsLegacyResourceBindingRepair
            key={`${reference.kind}:${reference.id}`}
            reference={reference}
            candidate={candidate}
            components={components}
            onRepair={(repaired) => onChange(value.map((item) =>
              item === reference ? repaired : item))}
          />
        )];
      })}
      <EnvironmentResourceBindingRowControls
        project={project}
        environment={environment}
        value={value}
        onChange={onChange}
      />
    </div>
  );
}
