/**
 * 环境配置子区：部署目标
 *
 * 单一职责：展示该环境当前绑定的服务器（部署目标），并在项目内完成绑定/解绑
 * （复用 BindServerBlock）；服务器生命周期的高级操作跳转专业模块 /servers。
 */
'use client';

import React from 'react';

import { useTranslations } from 'next-intl';
import { useEnvironmentActions } from '../../hooks/use-environment-actions';
import type { useProjectDetail } from '../../hooks/use-project-detail';
import type { ProjectEnvironment } from '../../types';
import { BindServerBlock } from '../environment-bind-server-block';
import { SubtabShell } from './settings-subtab-shell';

type DetailHook = ReturnType<typeof useProjectDetail>;

export function EnvTargetsTab({
  environment,
  detail,
}: {
  environment: ProjectEnvironment;
  detail: DetailHook;
}) {
  const t = useTranslations('projects');
  const projectId = detail.project?.id ?? '';
  const actions = useEnvironmentActions({
    environment,
    onSaved: detail.loadProject,
  });
  const bindings = environment.serverBindings ?? [];

  return (
    <SubtabShell
      title={t('envTabTargets')}
      helper={t('envTabHelperTargets')}
      moduleHref={`/servers?projectId=${encodeURIComponent(projectId)}`}
      moduleLabel={t('envModuleLinkServers')}
    >
      <div className="space-y-3">
        {bindings.length === 0 ? (
          <p className="text-xs text-muted-foreground">{t('envTargetsNone')}</p>
        ) : (
          <ul className="space-y-1 text-sm">
            {bindings.map((b) => (
              <li
                key={b.id}
                className="flex items-center justify-between gap-2 rounded-md border px-3 py-2"
              >
                <span className="min-w-0">
                  <span className="font-medium">{b.server.name}</span>
                  <span className="ml-2 font-mono text-xs text-muted-foreground">
                    {b.server.host}
                  </span>
                </span>
                {b.role ? (
                  <span className="shrink-0 text-xs text-muted-foreground">{b.role}</span>
                ) : null}
              </li>
            ))}
          </ul>
        )}
        <BindServerBlock environment={environment} actions={actions} t={t} />
      </div>
    </SubtabShell>
  );
}
