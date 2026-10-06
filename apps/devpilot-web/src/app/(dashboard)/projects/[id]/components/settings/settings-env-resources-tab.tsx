/**
 * 环境配置子区：资源绑定
 *
 * 单一职责：展示该环境的资源计数与当前不可变修订中的资源引用——Demo 对齐的
 * 六列表（资源需求/来源组件/绑定方式/资源实例/共享与隔离/校验）+ 真实健康/
 * 连接状态 + 共享与隔离/绑定方式选择器（走修订化保存）。实例供应生命周期
 * 跳 /resource-instances；项目页不提供资源创建/释放（AC-SET-027）。
 */
'use client';

import React from 'react';

import { useTranslations } from 'next-intl';
import type { useProjectDetail } from '../../hooks/use-project-detail';
import type { ProjectEnvironment } from '../../types';
import type {
  EnvironmentConfigResourceReference,
  EnvironmentConfigRevision,
} from '../../types/environment-config-revision.types';
import { EnvironmentResourceBindingTable } from '../environment-resource-binding-table';
import { SettingsResourceBindingModal } from './settings-resource-binding-modal';
import { SubtabShell } from './settings-subtab-shell';

type DetailHook = ReturnType<typeof useProjectDetail>;

export function EnvResourcesTab({
  environment,
  detail,
  resources,
  onResourcesChange,
  revision,
}: {
  environment: ProjectEnvironment;
  detail: DetailHook;
  resources: EnvironmentConfigResourceReference[];
  onResourcesChange: (next: EnvironmentConfigResourceReference[]) => void;
  revision: EnvironmentConfigRevision | null;
}) {
  const t = useTranslations('projects');
  const project = detail.project;
  const projectId = project?.id ?? '';
  if (!project) return null;

  return (
    <SubtabShell
      title={t('envTabResources')}
      helper={t('envTabHelperResources')}
      moduleHref={`/resource-instances?projectId=${encodeURIComponent(projectId)}`}
      moduleLabel={t('envModuleLinkResources')}
      actions={
        <SettingsResourceBindingModal
          project={project}
          environment={environment}
          value={resources}
          onChange={onResourcesChange}
          currentReferences={revision?.resourceReferences ?? []}
        />
      }
    >
      <div
        className="space-y-3 border-y py-3"
        data-settings-data-surface="true"
      >
        {revision ? (
          <p className="text-[11px] text-muted-foreground">
            {t('envResourceFrozenRevision', {
              revision: revision.revision,
              hash: revision.snapshotHash.slice(0, 8),
            })}
          </p>
        ) : null}
        <EnvironmentResourceBindingTable
          project={project}
          environment={environment}
          resources={revision?.resourceReferences ?? []}
        />
        <p className="border-t pt-3 text-xs leading-5 text-muted-foreground">
          {t('envResourceCalloutOwnership')}
        </p>
      </div>
    </SubtabShell>
  );
}
