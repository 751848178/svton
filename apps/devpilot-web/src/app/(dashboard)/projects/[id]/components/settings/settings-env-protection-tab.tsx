/**
 * 环境配置子区：保护规则
 *
 * 单一职责：展示环境保护规则（当前修订草稿中的访问策略引用 + 不可变身份状态），
 * 并在项目内完成环境写操作（编辑/归档）与配置复制/同步；审批生命周期跳
 * /operation-approvals。
 */
'use client';

import React from 'react';

import { useTranslations } from 'next-intl';
import type { useProjectDetail } from '../../hooks/use-project-detail';
import type { ProjectEnvironment } from '../../types';
import { EnvironmentCopyPanel } from '../environment-copy-panel';
import { EnvironmentSyncPanel } from '../environment-sync-panel';
import { EnvironmentWriteActions } from '../environment-write-actions';
import { environmentIdentityLabelKey } from './settings-env.model';
import { SubtabShell } from './settings-subtab-shell';

type DetailHook = ReturnType<typeof useProjectDetail>;

type Policy = { id: string; name: string; effect: string };

export function EnvProtectionTab({
  environment,
  detail,
  policies,
  policyIds,
  onPolicyIdsChange,
}: {
  environment: ProjectEnvironment;
  detail: DetailHook;
  policies: Policy[];
  policyIds: string[];
  onPolicyIdsChange: (next: string[]) => void;
}) {
  const t = useTranslations('projects');
  const project = detail.project;
  const projectId = project?.id ?? '';
  if (!project) return null;

  const toggle = (id: string, checked: boolean) => {
    onPolicyIdsChange(
      checked
        ? [...new Set([...policyIds, id])]
        : policyIds.filter((item) => item !== id),
    );
  };

  return (
    <SubtabShell
      title={t('envTabProtection')}
      helper={t('envTabHelperProtection')}
      moduleHref="/operation-approvals"
      moduleLabel={t('envModuleLinkApprovals')}
    >
      <div className="space-y-4">
        <div className="space-y-1">
          <div className="text-xs font-medium">{t('configPolicyReferences')}</div>
          {policies.length === 0 ? (
            <p className="text-xs text-muted-foreground">{t('envProtectionNone')}</p>
          ) : (
            <div className="flex flex-wrap gap-3 text-xs">
              {policies.map((policy) => (
                <label key={policy.id} className="flex items-center gap-1">
                  <input
                    type="checkbox"
                    checked={policyIds.includes(policy.id)}
                    onChange={(event) => toggle(policy.id, event.target.checked)}
                  />
                  {policy.name} · {policy.effect}
                </label>
              ))}
            </div>
          )}
        </div>

        <div className="rounded-md border p-3">
          <div className="text-xs font-medium">{t('envIdentitySectionTitle')}</div>
          <p className="mt-1 text-[11px] text-muted-foreground">
            {t('envIdentityKeyLabel')} <b className="font-mono">{environment.key}</b> ·{' '}
            {t(environmentIdentityLabelKey(environment))}
          </p>
        </div>

        <EnvironmentWriteActions environment={environment} onSaved={detail.loadProject} />
        {environment.status !== 'archived' ? (
          <>
            <EnvironmentCopyPanel environment={environment} project={project} onChanged={detail.loadProject} />
            <EnvironmentSyncPanel environment={environment} project={project} onChanged={detail.loadProject} />
          </>
        ) : null}
      </div>
    </SubtabShell>
  );
}
