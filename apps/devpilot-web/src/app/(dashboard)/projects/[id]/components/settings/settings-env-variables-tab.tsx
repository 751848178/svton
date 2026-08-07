/**
 * 环境配置子区：变量与密钥
 *
 * 单一职责：复用 EnvironmentEnvVarsSection 承载普通变量/密钥引用/资源实例注入展示，
 * 并展示当前修订草稿中的密钥引用选择；密钥生命周期管理跳 /keys。
 */
'use client';

import React from 'react';

import { useTranslations } from 'next-intl';
import type { useProjectDetail } from '../../hooks/use-project-detail';
import type { ProjectEnvironment } from '../../types';
import { EnvironmentEnvVarsSection } from '../environment-env-vars-section';
import { SubtabShell } from './settings-subtab-shell';

type DetailHook = ReturnType<typeof useProjectDetail>;

export function EnvVariablesTab({
  environment,
  detail,
  secretIds,
  onSecretIdsChange,
}: {
  environment: ProjectEnvironment;
  detail: DetailHook;
  secretIds: string[];
  onSecretIdsChange: (next: string[]) => void;
}) {
  const t = useTranslations('projects');
  const project = detail.project;
  const projectId = project?.id ?? '';
  if (!project) return null;

  const secrets = (project.secretKeys ?? []).filter(
    (secret) => !secret.environment || secret.environment.id === environment.id,
  );
  const keysManageHref = `/keys?projectId=${encodeURIComponent(projectId)}&environmentId=${encodeURIComponent(environment.id)}`;

  const toggle = (id: string, checked: boolean) => {
    onSecretIdsChange(
      checked
        ? [...new Set([...secretIds, id])]
        : secretIds.filter((item) => item !== id),
    );
  };

  return (
    <SubtabShell
      title={t('envTabVariables')}
      helper={t('envTabHelperVariables')}
      moduleHref={keysManageHref}
      moduleLabel={t('envModuleLinkKeys')}
    >
      <div className="space-y-4">
        <EnvironmentEnvVarsSection environment={environment} project={project} onSaved={detail.loadProject} />
        <div className="space-y-1">
          <div className="text-xs font-medium">{t('configSecretReferences')}</div>
          {secrets.length === 0 ? (
            <p className="text-xs text-muted-foreground">{t('configNoSecrets')}</p>
          ) : (
            <div className="flex flex-wrap gap-3 text-xs">
              {secrets.map((secret) => (
                <label key={secret.id} className="flex items-center gap-1">
                  <input
                    type="checkbox"
                    checked={secretIds.includes(secret.id)}
                    onChange={(event) => toggle(secret.id, event.target.checked)}
                  />
                  {secret.name} · {secret.type}
                </label>
              ))}
            </div>
          )}
          <p className="text-[11px] text-muted-foreground">{t('configSecretReferenceHint')}</p>
        </div>
      </div>
    </SubtabShell>
  );
}
