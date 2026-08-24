/**
 * 资源绑定六列表（Demo 对齐，AC-SET-032）
 *
 * 单一职责：把当前不可变修订的资源引用（含实例联接、共享与隔离模式、绑定
 * 方式、逐行校验、真实健康/连接状态）渲染为 Demo 六列只读表格；不提供任何
 * 创建/释放资源的能力。
 */
'use client';

import React from 'react';

import { useTranslations } from 'next-intl';
import type { Project, ProjectEnvironment } from '../types';
import type { EnvironmentConfigResourceReference } from '../types/environment-config-revision.types';
import type { ResourceConnectionProbe } from '../hooks/use-resource-connection-health';
import { useResourceConnectionHealth } from '../hooks/use-resource-connection-health';
import {
  buildBindingRows,
  BINDING_METHOD_LABEL_KEYS,
  SHARING_MODE_LABEL_KEYS,
  VALIDATION_LABEL_KEYS,
  type ResourceBindingRow,
} from './environment-resource-binding.model';

type ProjectsTranslator = ReturnType<typeof useTranslations<'projects'>>;

const HEADER_KEYS = [
  'envResourceTableRequirement',
  'envResourceTableSource',
  'envResourceTableBindingMethod',
  'envResourceTableInstance',
  'envResourceTableSharing',
  'envResourceTableValidation',
] as const;

const VALIDATION_PILL_CLASSES: Record<string, string> = {
  valid: 'bg-green-100 text-green-700',
  missing: 'bg-amber-100 text-amber-700',
  'out-of-scope': 'bg-orange-100 text-orange-700',
  forbidden: 'bg-red-100 text-red-700',
};

export function EnvironmentResourceBindingTable({
  project,
  environment,
  resources,
}: {
  project: Project;
  environment: ProjectEnvironment;
  resources: EnvironmentConfigResourceReference[];
}) {
  const t = useTranslations('projects');
  const rows = buildBindingRows(project, environment, resources);
  const { probes, loading, error } = useResourceConnectionHealth(project.id);

  if (resources.length === 0) {
    /* SET-13：不存在「当前修订」时不得谈论当前修订。 */
    const hasRevision = environment.currentConfigRevisionId != null;
    return (
      <p className="text-xs text-muted-foreground">
        {hasRevision ? t('envResourceTableEmpty') : t('envResourceTableEmptyNoRevision')}
      </p>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[720px] border-collapse text-sm">
        <thead>
          <tr className="border-b text-left text-xs text-muted-foreground">
            {HEADER_KEYS.map((key) => (
              <th key={key} className="py-2 pr-3 font-medium">{t(key)}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <BindingRowCell
              key={row.key}
              row={row}
              t={t}
              probes={probes}
              healthLoading={loading}
              healthError={Boolean(error)}
            />
          ))}
        </tbody>
      </table>
    </div>
  );
}

function BindingRowCell({
  row,
  t,
  probes,
  healthLoading,
  healthError,
}: {
  row: ResourceBindingRow;
  t: ProjectsTranslator;
  probes: Record<string, ResourceConnectionProbe>;
  healthLoading: boolean;
  healthError: boolean;
}) {
  const instanceCell = (
    <div className="space-y-0.5">
      <span className="font-mono text-xs">{row.instanceName ?? '—'}</span>
      {row.lifecycleStatus ? (
        <span className="block text-[11px] text-muted-foreground">{row.lifecycleStatus}</span>
      ) : null}
      <HealthLine
        row={row}
        t={t}
        probes={probes}
        healthLoading={healthLoading}
        healthError={healthError}
      />
    </div>
  );

  return (
    <tr className="border-b align-top">
      <td className="py-2 pr-3">
        <span className="font-medium">{row.requirement}</span>
        <span className="ml-1.5 text-[10px] text-muted-foreground">{row.reference.kind}</span>
      </td>
      <td className="py-2 pr-3 text-xs text-muted-foreground">{row.source}</td>
      <td className="py-2 pr-3 text-xs">{t(BINDING_METHOD_LABEL_KEYS[row.bindingMethod])}</td>
      <td className="py-2 pr-3">{instanceCell}</td>
      <td className="py-2 pr-3 text-xs">
        <span>{t(SHARING_MODE_LABEL_KEYS[row.sharingMode])}</span>
        {row.sharingMode === 'production-forced' ? (
          <span className="ml-1.5 text-[10px] text-red-600">{t('envResourceSharingProdForbidden')}</span>
        ) : null}
      </td>
      <td className="py-2">
        <span
          className={`inline-block rounded px-1.5 py-0.5 text-[10px] font-medium ${VALIDATION_PILL_CLASSES[row.validation]}`}
        >
          {t(VALIDATION_LABEL_KEYS[row.validation])}
        </span>
      </td>
    </tr>
  );
}

function HealthLine({
  row,
  t,
  probes,
  healthLoading,
  healthError,
}: {
  row: ResourceBindingRow;
  t: ProjectsTranslator;
  probes: Record<string, ResourceConnectionProbe>;
  healthLoading: boolean;
  healthError: boolean;
}) {
  if (row.reference.kind !== 'managed_resource' || !row.managedHealth) return null;
  if (healthLoading) return <span className="block text-[11px] text-muted-foreground">{t('loading')}</span>;
  if (healthError) return <span className="block text-[11px] text-red-600">{t('envResourceHealthUnavailable')}</span>;
  const probe = probes[row.reference.id];
  const parts = [
    row.managedHealth.endpoint ?? null,
    probe
      ? `${t(probe.status === 'ok' ? 'envResourceHealthOk' : 'envResourceHealthFailed')}${probe.at ? ` · ${t('envResourceHealthProbeAt', { at: probe.at })}` : ''}`
      : t('envResourceHealthNone'),
  ].filter(Boolean);
  return <span className="block text-[11px] text-muted-foreground">{parts.join(' · ')}</span>;
}
