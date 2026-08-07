/**
 * 环境配置子区：部署目标
 *
 * 单一职责：以 Demo 对齐的表格（组件/运行目标/区域·命名空间/规模/状态）展示
 * 该环境的全部活动绑定，并用与部署路径相同的解析标出 provider-matched 当前生效
 * 目标（AC-SET-017/023/024）；每行 调整目标 打开可审计的编辑面（AC-SET-018），
 * 共享范围显式声明且默认隔离（AC-SET-019）。
 */
'use client';

import React, { useState } from 'react';

import { useTranslations } from 'next-intl';
import { useEnvironmentActions } from '../../hooks/use-environment-actions';
import { useEnvironmentDeploymentTargets } from '../../hooks/use-environment-deployment-targets';
import type { useProjectDetail } from '../../hooks/use-project-detail';
import type { ProjectEnvironment } from '../../types';
import type { EnvironmentDeploymentTargetBinding } from '../../types';
import { BindServerBlock } from '../environment-bind-server-block';
import {
  SettingsEnvTargetEditDialog,
  targetEditDraftFrom,
  type TargetEditDraft,
} from './settings-env-target-edit-dialog';
import { SubtabShell } from './settings-subtab-shell';
import type { DeploymentTargetsHook } from './settings-env-tab-switch';

type DetailHook = ReturnType<typeof useProjectDetail>;

export function EnvTargetsTab({
  environment,
  detail,
  targets,
}: {
  environment: ProjectEnvironment;
  detail: DetailHook;
  targets?: DeploymentTargetsHook;
}) {
  const t = useTranslations('projects');
  const projectId = detail.project?.id ?? '';
  const actions = useEnvironmentActions({
    environment,
    onSaved: detail.loadProject,
  });
  const ownTargets = useEnvironmentDeploymentTargets(environment.id);
  const resolvedTargets = targets ?? ownTargets;
  const [editing, setEditing] = useState<TargetEditDraft | null>(null);
  const bindings = resolvedTargets.data?.bindings ?? [];
  const current = resolvedTargets.data?.currentTarget ?? null;
  const otherEnvironments =
    detail.project?.environments?.filter(
      (env) => env.id !== environment.id && env.status !== 'archived',
    ) ?? [];

  return (
    <SubtabShell
      title={t('envTabTargets')}
      helper={t('envTabHelperTargets')}
      moduleHref={`/servers?projectId=${encodeURIComponent(projectId)}`}
      moduleLabel={t('envModuleLinkServers')}
    >
      {resolvedTargets.loading ? (
        <p className="text-xs text-muted-foreground">{t('loading')}</p>
      ) : resolvedTargets.error ? (
        <p className="text-xs text-red-600">{resolvedTargets.error}</p>
      ) : bindings.length === 0 ? (
        <p className="text-xs text-muted-foreground">{t('envTargetsNone')}</p>
      ) : (
        <div className="space-y-3">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[560px] border-collapse text-sm">
              <thead>
                <tr className="border-b text-left text-xs text-muted-foreground">
                  <th className="py-2 pr-3 font-medium">{t('envTargetTableComponent')}</th>
                  <th className="py-2 pr-3 font-medium">{t('envTargetTableRunTarget')}</th>
                  <th className="py-2 pr-3 font-medium">{t('envTargetTableRegionNamespace')}</th>
                  <th className="py-2 pr-3 font-medium">{t('envTargetTableScale')}</th>
                  <th className="py-2 pr-3 font-medium">{t('envTargetTableStatus')}</th>
                  <th className="py-2 font-medium">{t('envTargetTableActions')}</th>
                </tr>
              </thead>
              <tbody>
                {bindings.map((binding) => (
                  <BindingRow
                    key={binding.id}
                    binding={binding}
                    isCurrent={current?.bindingId === binding.id}
                    currentTargetRef={current?.bindingId === binding.id ? current.targetRef : null}
                    t={t}
                    onAdjust={() => setEditing(targetEditDraftFrom(binding, current))}
                    onUnbind={() => void actions.unbindServer(binding.id, binding.server.id)}
                  />
                ))}
              </tbody>
            </table>
          </div>
          <SharedScopeLine
            bindings={bindings}
            environmentKeys={environmentKeyById(detail)}
            t={t}
          />
          {current ? (
            <p className="font-mono text-[11px] text-muted-foreground">
              {t('envTargetVersionHashLabel')} {current.versionHash}
            </p>
          ) : null}
        </div>
      )}
      <div className="mt-3">
        <BindServerBlock environment={environment} actions={actions} t={t} />
      </div>

      <SettingsEnvTargetEditDialog
        open={Boolean(editing)}
        draft={editing}
        otherEnvironments={otherEnvironments}
        onClose={() => setEditing(null)}
        onConfirm={async (input) => {
          const ok = await actions.bindServer(
            editing?.serverId ?? '',
            input,
          );
          if (ok) {
            setEditing(null);
            void resolvedTargets.reload();
          }
          return ok;
        }}
      />
    </SubtabShell>
  );
}

function BindingRow({
  binding,
  isCurrent,
  currentTargetRef,
  t,
  onAdjust,
  onUnbind,
}: {
  binding: EnvironmentDeploymentTargetBinding;
  isCurrent: boolean;
  currentTargetRef: string | null;
  t: ReturnType<typeof useTranslations<'projects'>>;
  onAdjust: () => void;
  onUnbind: () => void;
}) {
  return (
    <tr className="border-b">
      <td className="py-2 pr-3">
        <span className="font-medium">{binding.server.name}</span>
        {binding.role ? (
          <span className="ml-1 rounded bg-muted px-1 py-0.5 text-[10px] text-muted-foreground">
            {binding.role}
          </span>
        ) : null}
        {isCurrent ? (
          <span className="ml-1.5 inline-block rounded bg-green-100 px-1.5 py-0.5 text-[10px] font-medium text-green-700">
            {t('envTargetCurrentBadge')}
          </span>
        ) : null}
      </td>
      <td className="py-2 pr-3">
        {currentTargetRef ? (
          <span className="font-mono text-xs">{currentTargetRef}</span>
        ) : binding.providerKey ? (
          <span className="font-mono text-xs">{binding.providerKey}</span>
        ) : (
          <span className="text-xs text-muted-foreground">{t('envTargetNotApplicable')}</span>
        )}
      </td>
      <td className="py-2 pr-3 font-mono text-xs text-muted-foreground">
        {binding.server.host || t('envTargetNotApplicable')}
      </td>
      <td className="py-2 pr-3 text-xs text-muted-foreground">{t('envTargetNotApplicable')}</td>
      <td className="py-2 pr-3 text-xs">
        {binding.server.status === 'online' ? (
          <span className="text-green-700">{t('envTargetStatusOnline')}</span>
        ) : (
          <span className="text-red-600">{t('envTargetStatusOffline')}</span>
        )}
      </td>
      <td className="py-2 text-right text-xs">
        <button
          type="button"
          className="text-primary hover:underline"
          onClick={onAdjust}
        >
          {t('envTargetAdjust')}
        </button>
        <button
          type="button"
          className="ml-3 text-red-600 hover:underline"
          onClick={onUnbind}
        >
          {t('envUnbindServer')}
        </button>
      </td>
    </tr>
  );
}

function SharedScopeLine({
  bindings,
  environmentKeys,
  t,
}: {
  bindings: EnvironmentDeploymentTargetBinding[];
  environmentKeys: Record<string, string>;
  t: ReturnType<typeof useTranslations<'projects'>>;
}) {
  const shared = bindings.filter((binding) => binding.sharedEnvironmentIds.length > 0);
  return (
    <p className="text-[11px] text-muted-foreground">
      {shared.length === 0
        ? t('envTargetIsolationDefault')
        : shared
            .map((binding) => {
              const keys = binding.sharedEnvironmentIds
                .map((id) => environmentKeys[id] ?? id)
                .join(', ');
              return `${binding.server.name} → ${keys}`;
            })
            .join('；')}
    </p>
  );
}

function environmentKeyById(
  detail: ReturnType<typeof useProjectDetail>,
): Record<string, string> {
  const map: Record<string, string> = {};
  for (const env of detail.project?.environments ?? []) {
    map[env.id] = env.key;
  }
  return map;
}
