/**
 * 环境配置子区：资源绑定
 *
 * 单一职责：展示该环境的资源计数与当前修订中的资源引用（绑定/换绑/解除在项目内
 * 完成，复用 EnvironmentConfigResourceEditor）；实例供应生命周期跳 /resource-instances。
 */
'use client';

import React from 'react';

import { useTranslations } from 'next-intl';
import type { useProjectDetail } from '../../hooks/use-project-detail';
import type { ProjectEnvironment } from '../../types';
import type { EnvironmentConfigResourceReference } from '../../types/environment-config-revision.types';
import { EnvironmentConfigResourceEditor } from '../environment-config-resource-editor';
import { ResourceCountChips } from '../environment-resource-count-chips';
import { SubtabShell } from './settings-subtab-shell';

type DetailHook = ReturnType<typeof useProjectDetail>;

export function EnvResourcesTab({
  environment,
  detail,
  resources,
  onResourcesChange,
}: {
  environment: ProjectEnvironment;
  detail: DetailHook;
  resources: EnvironmentConfigResourceReference[];
  onResourcesChange: (next: EnvironmentConfigResourceReference[]) => void;
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
    >
      <div className="space-y-3">
        <ResourceCountChips environment={environment} t={t} />
        <EnvironmentConfigResourceEditor
          project={project}
          environment={environment}
          value={resources}
          onChange={onResourcesChange}
        />
      </div>
    </SubtabShell>
  );
}
