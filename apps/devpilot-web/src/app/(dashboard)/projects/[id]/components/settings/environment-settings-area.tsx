/**
 * 环境配置区（顶层区域）
 *
 * 单一职责：渲染「环境配置」区域的标题行、Staging/Production 环境选择器与创建入口，
 * 依据 ?env=<key> 深链解析活动环境（未命中则回退第一个非归档环境），
 * 并把配置详情按 environment.id 挂载（key 重挂载保证切换环境时草稿重置）。
 */
'use client';

import React from 'react';

import { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Button, EmptyState } from '@svton/ui';
import { StatusTag } from '@/components/ui';
import type { useProjectDetail } from '../../hooks/use-project-detail';
import { readSettingsEnvKey, settingsHref } from '../../utils/project-route.utils';
import { EnvironmentCreateModal } from '../environment-create-modal';
import { EnvironmentSettingsDetail } from './environment-settings-detail';
import { isGovernedEnvironmentSet } from './settings-env.model';
import { groupSettingsEnvironments } from './settings-environment-groups.model';

type DetailHook = ReturnType<typeof useProjectDetail>;

export function EnvironmentSettingsArea({ detail }: { detail: DetailHook }) {
  const t = useTranslations('projects');
  const router = useRouter();
  const searchParams = useSearchParams();
  const [createOpen, setCreateOpen] = useState(false);
  const project = detail.project;
  const projectId = project?.id ?? '';
  const environments = (project?.environments ?? []).filter((env) => env.status !== 'archived');
  const governed = isGovernedEnvironmentSet(project?.environments ?? []);
  const requestedKey = readSettingsEnvKey(searchParams);
  const activeEnv = environments.find((env) => env.key === requestedKey) ?? environments[0] ?? null;

  if (!project) return null;

  const selectEnv = (key: string) => {
    const next = new URLSearchParams(searchParams);
    next.set('env', key);
    router.replace(settingsHref(projectId, 'environments', next), { scroll: false });
  };

  const enabledCount = environments.filter((env) => env.status === 'active').length;
  const environmentGroups = groupSettingsEnvironments(environments);

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold">{t('envManagementTitle')}</h2>
          <p className="mt-1 text-xs text-muted-foreground">{t('envManagementDescription')}</p>
        </div>
        <div className="flex items-center gap-2">
          <StatusTag
            status="success"
            label={`${t('envStatusActive')} ${enabledCount} / ${environments.length}`}
          />
          {!governed ? (
            <Button variant="ghost" size="sm" onClick={() => setCreateOpen(true)}>
              + {t('envCreateAction')}
            </Button>
          ) : null}
        </div>
      </div>

      <div className="space-y-3" aria-label={t('envSwitchLabel')}>
        {environmentGroups.map((group) => (
          <div key={group.key} role="group" aria-label={t(group.labelKey)}>
            <div className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              {t(group.labelKey)}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {group.environments.map((env) => (
                <button
                  key={env.id}
                  type="button"
                  onClick={() => selectEnv(env.key)}
                  aria-pressed={activeEnv?.id === env.id}
                  className={
                    activeEnv?.id === env.id
                      ? 'min-h-11 rounded-md border border-primary bg-primary/10 px-3 py-2 text-sm font-medium text-blue-800'
                      : 'min-h-11 rounded-md border px-3 py-2 text-sm text-muted-foreground hover:bg-accent hover:text-foreground'
                  }
                >
                  <span>{env.key} · {env.name}</span>
                  <span className="ml-1.5 rounded bg-muted px-1 py-0.5 text-[10px]">
                    {t(env.baselineRole === 'staging'
                      ? 'envRoleStaging'
                      : env.baselineRole === 'production'
                        ? 'envRoleProduction'
                        : 'envRoleCustom')}
                  </span>
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>

      {activeEnv ? (
        <EnvironmentSettingsDetail key={activeEnv.id} detail={detail} environment={activeEnv} />
      ) : (
        <EmptyState text={t('noEnvironments')} />
      )}

      <EnvironmentCreateModal
        open={createOpen}
        projectId={project.id}
        onClose={() => setCreateOpen(false)}
        onChanged={detail.loadProject}
      />
    </section>
  );
}
