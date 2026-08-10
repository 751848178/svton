/**
 * 资源绑定行编辑控件（AC-SET-026）
 *
 * 单一职责：每行的 绑定方式 select（绑定已有实例/换绑到其他实例/解除绑定/
 * 使用允许共享的实例）与 共享与隔离 select（环境专用/仅非生产共享·逻辑隔离/
 * Production 专用（强制））以及共享环境勾选；所有写回委托给 model 纯函数，
 * 变更写入共享草稿后由修订化保存提交。Production 环境强制环境专用。
 */
'use client';

import React, { useState } from 'react';

import { useTranslations } from 'next-intl';
import type { Project, ProjectEnvironment } from '../types';
import type { EnvironmentConfigResourceReference } from '../types/environment-config-revision.types';
import {
  applyBindingMethod,
  applyRebind,
  applySharedEnvironmentToggle,
  applySharingMode,
  BINDING_METHOD_LABEL_KEYS,
  candidatesOfKind,
  isProductionEnvironment,
  resourceSharingMode,
  SHARING_MODE_LABEL_KEYS,
  type BindingMethod,
  type SharingMode,
} from './environment-resource-binding.model';

type ProjectsTranslator = ReturnType<typeof useTranslations<'projects'>>;

export function EnvironmentResourceBindingRowControls({
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
  const production = isProductionEnvironment(environment);

  const update = (index: number, patch: Partial<EnvironmentConfigResourceReference>) => {
    onChange(value.map((item, itemIndex) => itemIndex === index ? { ...item, ...patch } : item));
  };

  const rebindTo = (index: number, candidate: { id: string; name: string }) => {
    onChange(applyRebind(value, index, candidate));
  };

  return (
    <div className="space-y-2">
      {value.length === 0 ? (
        <p className="text-xs text-muted-foreground">{t('configNoResourceReferences')}</p>
      ) : value.map((item, index) => (
        <RowControls
          key={`${item.kind}:${item.id}`}
          item={item}
          index={index}
          production={production}
          environment={environment}
          project={project}
          t={t}
          onBindingMethod={(method) => onChange(applyBindingMethod(value, index, method, environment, project))}
          onSharingMode={(mode) => onChange(applySharingMode(value, index, mode, environment, project))}
          onToggleEnvironment={(environmentId, checked) =>
            onChange(applySharedEnvironmentToggle(value, index, environmentId, checked))}
          onRebindTo={rebindTo}
          onUpdate={update}
          onRemove={() => onChange(value.filter((_, itemIndex) => itemIndex !== index))}
        />
      ))}
    </div>
  );
}

function RowControls({
  item,
  index,
  production,
  environment,
  project,
  t,
  onBindingMethod,
  onSharingMode,
  onToggleEnvironment,
  onRebindTo,
  onUpdate,
  onRemove,
}: {
  item: EnvironmentConfigResourceReference;
  index: number;
  production: boolean;
  environment: ProjectEnvironment;
  project: Project;
  t: ProjectsTranslator;
  onBindingMethod: (method: BindingMethod) => void;
  onSharingMode: (mode: SharingMode) => void;
  onToggleEnvironment: (environmentId: string, checked: boolean) => void;
  onRebindTo: (index: number, candidate: { id: string; name: string }) => void;
  onUpdate: (index: number, patch: Partial<EnvironmentConfigResourceReference>) => void;
  onRemove: () => void;
}) {
  const [rebinding, setRebinding] = useState(false);
  const sharingMode = resourceSharingMode(environment, item);
  const candidates = candidatesOfKind(project, item.kind, item.id);
  const shareableEnvironments = (project.environments ?? [])
    .filter((candidate) => candidate.id !== environment.id && candidate.status === 'active' && candidate.baselineRole !== 'production');

  return (
    <div className="space-y-2 rounded-md bg-muted/40 p-2 text-xs">
      <div className="flex items-center justify-between gap-2">
        <span className="font-medium">{item.name} · {item.kind}</span>
        <button type="button" className="text-destructive" onClick={onRemove}>
          {t('envResourceUnbind')}
        </button>
      </div>
      <div className="grid gap-2 sm:grid-cols-2">
        <label className="flex flex-col gap-1">
          <span className="text-[10px] text-muted-foreground">{t('envResourceTableBindingMethod')}</span>
          <select
            className="rounded-md border bg-background px-2 py-1"
            value={sharingMode === 'shared' ? 'use-shared' : 'bind-existing'}
            onChange={(event) => {
              const method = event.target.value as BindingMethod;
              if (method === 'rebind') setRebinding(true);
              else onBindingMethod(method);
            }}
            aria-label={t('envResourceTableBindingMethod')}
          >
            <option value="bind-existing">{t(BINDING_METHOD_LABEL_KEYS['bind-existing'])}</option>
            <option value="rebind">{t(BINDING_METHOD_LABEL_KEYS.rebind)}</option>
            <option value="unbind">{t(BINDING_METHOD_LABEL_KEYS.unbind)}</option>
            <option value="use-shared" disabled={production}>{t(BINDING_METHOD_LABEL_KEYS['use-shared'])}</option>
          </select>
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-[10px] text-muted-foreground">{t('envResourceSharingScopeLabel')}</span>
          {production ? (
            <span className="rounded-md border bg-background px-2 py-1 text-[11px] text-red-600">
              {t('envResourceSharingProductionForced')} · {t('envResourceSharingProdForbidden')}
            </span>
          ) : (
            <select
              className="rounded-md border bg-background px-2 py-1"
              value={sharingMode}
              onChange={(event) => onSharingMode(event.target.value as SharingMode)}
              aria-label={t('envResourceSharingScopeLabel')}
            >
              <option value="dedicated">{t(SHARING_MODE_LABEL_KEYS.dedicated)}</option>
              <option value="shared">{t(SHARING_MODE_LABEL_KEYS.shared)}</option>
            </select>
          )}
        </label>
      </div>
      {production ? null : sharingMode === 'shared' ? (
        <div className="flex flex-wrap gap-3">
          <span className="text-[10px] text-muted-foreground">{t('envResourceSharingScopeLabel')}</span>
          {shareableEnvironments.length === 0 ? (
            <span className="text-[11px] text-muted-foreground">{t('envResourceTableEmpty')}</span>
          ) : shareableEnvironments.map((candidate) => (
            <label key={candidate.id} className="flex items-center gap-1">
              <input
                type="checkbox"
                checked={item.sharedEnvironmentIds.includes(candidate.id)}
                onChange={(event) => onToggleEnvironment(candidate.id, event.target.checked)}
              />
              {candidate.name}
            </label>
          ))}
        </div>
      ) : null}
      {rebinding ? (
        <div className="flex items-center gap-2">
          <select
            className="min-w-0 flex-1 rounded-md border bg-background px-2 py-1"
            defaultValue=""
            onChange={(event) => {
              const candidate = candidates.find((entry) => entry.id === event.target.value);
              if (candidate) onRebindTo(index, candidate);
              setRebinding(false);
            }}
            aria-label={t('envResourceRebindSelect')}
          >
            <option value="">{t('envResourceRebindSelect')}</option>
            {candidates.map((candidate) => (
              <option key={candidate.id} value={candidate.id}>{candidate.name}</option>
            ))}
          </select>
          <button type="button" className="text-muted-foreground" onClick={() => setRebinding(false)}>
            {t('configReferenceRemove')}
          </button>
        </div>
      ) : (
        <button
          type="button"
          className="text-primary"
          onClick={() => setRebinding(true)}
          disabled={candidates.length === 0}
        >
          {t('envResourceRebind')}
        </button>
      )}
      <div className="grid grid-cols-[110px_1fr] gap-2">
        <select
          className="rounded-md border bg-background px-2 py-1"
          value={item.risk}
          onChange={(event) => onUpdate(index, { risk: event.target.value as EnvironmentConfigResourceReference['risk'] })}
          aria-label="risk"
        >
          <option value="low">low</option><option value="medium">medium</option><option value="high">high</option>
        </select>
        <input
          className="rounded-md border bg-background px-2 py-1"
          value={item.impact}
          onChange={(event) => onUpdate(index, { impact: event.target.value })}
          placeholder={t('configResourceImpact')}
        />
      </div>
    </div>
  );
}
