/** 环境部署目标：只展示真实 binding/currentTarget，写操作进入可审计弹层。 */
'use client';

import React, { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui';
import { useEnvironmentActions } from '../../hooks/use-environment-actions';
import type { useProjectDetail } from '../../hooks/use-project-detail';
import type { ProjectEnvironment } from '../../types';
import { SettingsEnvTargetCreateDialog } from './settings-env-target-create-dialog';
import {
  SettingsEnvTargetEditDialog,
  targetEditDraftFrom,
  type TargetEditDraft,
} from './settings-env-target-edit-dialog';
import { SubtabShell } from './settings-subtab-shell';
import type { DeploymentTargetsHook } from './settings-env-tab-switch';
import { EnvironmentTargetBindingRow } from './settings-env-target-rows';

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
  const actions = useEnvironmentActions({
    environment,
    onSaved: detail.loadProject,
  });
  const resolvedTargets = targets;
  const [editing, setEditing] = useState<TargetEditDraft | null>(null);
  const [creating, setCreating] = useState(false);
  const bindings = resolvedTargets.data?.bindings ?? [];
  const current = resolvedTargets.data?.currentTarget ?? null;

  return (
    <SubtabShell
      title={t('envTabTargets')}
      helper={t('envTabHelperTargets')}
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
          <div
            className="overflow-x-auto rounded-md border px-3"
            data-settings-data-surface="true"
          >
            <table className="w-full min-w-[600px] border-collapse text-sm">
              <thead>
                <tr className="border-b text-left text-xs text-muted-foreground">
                  <th className="py-2 pr-3 font-medium">{t('envTargetTableServer')}</th>
                  <th className="py-2 pr-3 font-medium">{t('envTargetTablePath')}</th>
                  <th className="py-2 pr-3 font-medium">{t('envTargetTableStatus')}</th>
                  <th className="py-2 font-medium">{t('envTargetTableActions')}</th>
                </tr>
              </thead>
              <tbody>
                {bindings.length === 0 ? (
                  <tr>
                    <td
                      colSpan={4}
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
                      t={t}
                      onAdjust={() => setEditing(targetEditDraftFrom(binding, current))}
                    />
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
      <SettingsEnvTargetCreateDialog
        open={creating}
        excludeIds={bindings.map((binding) => binding.server.id)}
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
    </SubtabShell>
  );
}
