/**
 * 环境配置子区：部署目标
 *
 * 单一职责：用一张表展示该环境的真实服务器、Provider、部署目录/目标、连接与
 * 认证状态；绑定和调整都写入可审计目标配置，共享范围显式声明且默认隔离。
 */
'use client';

import React, { useState } from 'react';

import { useTranslations } from 'next-intl';
import { Button, ConfirmDialog } from '@/components/ui';
import { useEnvironmentActions } from '../../hooks/use-environment-actions';
import type { useProjectDetail } from '../../hooks/use-project-detail';
import type { EnvironmentDeploymentTargetBinding, ProjectEnvironment } from '../../types';
import { selectExistingProjectEnvironments } from '../../utils/project-environment-list';
import { SettingsEnvTargetCreateDialog } from './settings-env-target-create-dialog';
import {
  SettingsEnvTargetEditDialog,
  targetEditDraftFrom,
  type TargetEditDraft,
} from './settings-env-target-edit-dialog';
import { SubtabShell } from './settings-subtab-shell';
import type { DeploymentTargetsHook } from './settings-env-tab-switch';
import {
  EnvironmentTargetBindingRow,
  EnvironmentTargetSharedScope,
} from './settings-env-target-rows';

type DetailHook = ReturnType<typeof useProjectDetail>;

export function EnvTargetsTab({
  environment,
  detail,
  targets,
}: {
  environment: ProjectEnvironment;
  detail: DetailHook;
  targets: DeploymentTargetsHook;
}) {
  const t = useTranslations('projects');
  const projectId = detail.project?.id ?? '';
  const actions = useEnvironmentActions({
    environment,
    onSaved: detail.loadProject,
  });
  const resolvedTargets = targets;
  const [editing, setEditing] = useState<TargetEditDraft | null>(null);
  const [creating, setCreating] = useState(false);
  const [unbinding, setUnbinding] = useState<EnvironmentDeploymentTargetBinding | null>(null);
  const bindings = resolvedTargets.data?.bindings ?? [];
  const current = resolvedTargets.data?.currentTarget ?? null;
  const otherEnvironments = selectExistingProjectEnvironments(detail.project?.environments).filter(
    (env) => env.id !== environment.id,
  );

  return (
    <SubtabShell
      title={t('envTabTargets')}
      helper={t('envTabHelperTargets')}
      moduleHref={`/servers?projectId=${encodeURIComponent(projectId)}`}
      moduleLabel={t('envModuleLinkServers')}
      actions={
        <Button
          size="sm"
          onClick={() => setCreating(true)}
          disabled={actions.acting}
        >
          + {t('envTargetCreate')}
        </Button>
      }
    >
      {resolvedTargets.loading ? (
        <p className="text-xs text-muted-foreground">{t('loading')}</p>
      ) : resolvedTargets.error ? (
        <p className="text-xs text-red-600">{resolvedTargets.error}</p>
      ) : (
        <div className="space-y-3">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[560px] border-collapse text-sm">
              <thead>
                <tr className="border-b text-left text-xs text-muted-foreground">
                  <th className="py-2 pr-3 font-medium">{t('envTargetTableServer')}</th>
                  <th className="py-2 pr-3 font-medium">{t('envTargetTableProvider')}</th>
                  <th className="py-2 pr-3 font-medium">{t('envTargetTablePath')}</th>
                  <th className="py-2 pr-3 font-medium">{t('envTargetTableConnection')}</th>
                  <th className="py-2 pr-3 font-medium">{t('envTargetTableCredential')}</th>
                  <th className="py-2 font-medium">{t('envTargetTableActions')}</th>
                </tr>
              </thead>
              <tbody>
                {bindings.length === 0 ? (
                  <tr>
                    <td
                      colSpan={6}
                      className="py-8 text-center text-xs text-muted-foreground"
                    >
                      {t('envTargetsNone')}
                    </td>
                  </tr>
                ) : (
                  bindings.map((binding) => (
                    <EnvironmentTargetBindingRow
                      key={binding.id}
                      binding={binding}
                      isCurrent={current?.bindingId === binding.id}
                      currentRoot={current?.bindingId === binding.id ? current.root : null}
                      targetReady={
                        current?.bindingId === binding.id &&
                        resolvedTargets.data?.currentTarget != null
                      }
                      serverHref={`/servers?projectId=${encodeURIComponent(projectId)}&serverId=${encodeURIComponent(binding.server.id)}`}
                      t={t}
                      onAdjust={() => setEditing(targetEditDraftFrom(binding, current))}
                      onUnbind={() => setUnbinding(binding)}
                    />
                  ))
                )}
              </tbody>
            </table>
          </div>
          {bindings.length > 0 ? (
            <EnvironmentTargetSharedScope
              bindings={bindings}
              environmentKeys={environmentKeyById(detail)}
              t={t}
            />
          ) : null}
          {current ? (
            <p className="font-mono text-[11px] text-muted-foreground">
              {t('envTargetVersionHashLabel')} {current.versionHash}
            </p>
          ) : null}
        </div>
      )}

      <SettingsEnvTargetCreateDialog
        open={creating}
        excludeIds={bindings.map((binding) => binding.server.id)}
        otherEnvironments={otherEnvironments}
        onClose={() => setCreating(false)}
        onConfirm={async (serverId, input) => {
          const ok = await actions.bindServer(serverId, input);
          if (ok) void resolvedTargets.reload();
          return ok;
        }}
      />

      <SettingsEnvTargetEditDialog
        open={Boolean(editing)}
        draft={editing}
        otherEnvironments={otherEnvironments}
        onClose={() => setEditing(null)}
        onConfirm={async (input) => {
          const ok = await actions.bindServer(editing?.serverId ?? '', input);
          if (ok) {
            setEditing(null);
            void resolvedTargets.reload();
          }
          return ok;
        }}
      />
      <ConfirmDialog
        open={Boolean(unbinding)}
        onOpenChange={(open) => {
          if (!open) setUnbinding(null);
        }}
        tone="danger"
        title={t('envTargetUnbindTitle')}
        description={t('envTargetUnbindConfirm', { name: unbinding?.server.name ?? '' })}
        confirmLabel={t('envUnbindServer')}
        onConfirm={async () => {
          if (!unbinding) return;
          const ok = await actions.unbindServer(unbinding.id, unbinding.server.id);
          if (ok) {
            setUnbinding(null);
            void resolvedTargets.reload();
          }
        }}
      />
    </SubtabShell>
  );
}

function environmentKeyById(detail: ReturnType<typeof useProjectDetail>): Record<string, string> {
  const map: Record<string, string> = {};
  for (const env of detail.project?.environments ?? []) {
    map[env.id] = env.key;
  }
  return map;
}
