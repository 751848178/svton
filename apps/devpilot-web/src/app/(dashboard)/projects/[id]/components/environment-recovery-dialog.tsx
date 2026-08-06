'use client';

import React, { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Dialog } from '@svton/ui';
import type { RecoveryCreateResult } from '../hooks/use-recovery-confirm';
import { useRecoveryConfirm } from '../hooks/use-recovery-confirm';
import type { EnvironmentVersionEnvironment } from '../types/environment-version.types';
import { formatIso } from '../utils/release-time.utils';
import { EnvironmentVersionSummary } from './environment-version-summary';

interface Props {
  projectId: string;
  environment: EnvironmentVersionEnvironment;
  defaultSourceVersionId: string;
  onClose: () => void;
  onConfirmed: (result: RecoveryCreateResult, sourceVersionId: string) => void;
}

/**
 * Production 回退对话框。
 *
 * 单一职责：选择历史成功版本并创建新的恢复发布（recovery ReleaseRun + approval）。
 * 确认总是先取最新恢复快照再提交，配置漂移时服务端会强制基于最新快照重新确认。
 */
export function EnvironmentRecoveryDialog({
  projectId,
  environment,
  defaultSourceVersionId,
  onClose,
  onConfirmed,
}: Props) {
  const t = useTranslations('projects');
  const { working, error, create } = useRecoveryConfirm(projectId);
  const historical = environment.environmentVersions.filter(
    (version) => version.id !== environment.currentEnvironmentVersionId,
  );
  const [selectedId, setSelectedId] = useState(
    defaultSourceVersionId || historical[0]?.id || '',
  );
  const selected = historical.find((version) => version.id === selectedId) || null;
  const current = environment.environmentVersions.find(
    (version) => version.id === environment.currentEnvironmentVersionId,
  ) || null;

  const handleConfirm = async () => {
    const result = await create(environment.id, selectedId);
    if (result) onConfirmed(result, selectedId);
  };

  return (
    <Dialog
      open
      onClose={onClose}
      title={t('environmentVersionRecoveryDialogTitle')}
      confirmText={t('environmentVersionRecoveryCreateAction')}
      cancelText={t('releaseGateCancel')}
      onConfirm={() => void handleConfirm()}
      loading={working}
      confirmDisabled={!selected || working}
    >
      <div className="space-y-3">
        <p className="rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm text-amber-800">
          {t('environmentVersionRecoveryDialogCallout')}
        </p>
        <label className="block text-sm">
          <span className="mb-1 block font-medium">{t('environmentVersionRecoveryTarget')}</span>
          <select
            className="w-full rounded-md border bg-background px-3 py-2"
            value={selectedId}
            onChange={(event) => setSelectedId(event.target.value)}
            disabled={working}
          >
            {historical.map((version) => (
              <option
                key={version.id}
                value={version.id}
              >
                {t('environmentVersionCandidateOption', {
                  version: version.releaseOrder.releaseVersion,
                  revision: version.artifactManifest.buildRun.revision,
                })}
                {t('environmentVersionRecoveryVersionKind', {
                  kind: t(environmentVersionKindKey(version.kind)),
                  date: formatIso(version.effectiveAt),
                })}
              </option>
            ))}
          </select>
        </label>
        {selected ? <EnvironmentVersionSummary version={selected} /> : null}
        <dl className="grid gap-2 text-sm">
          <div className="flex items-baseline justify-between gap-2 rounded bg-muted/40 p-2">
            <dt className="font-medium">{t('environmentVersionCurrent')}</dt>
            <dd className="text-xs text-muted-foreground">
              {current
                ? t('environmentVersionCurrentValue', {
                    version: current.releaseOrder.releaseVersion,
                  })
                : t('environmentVersionUnavailable')}
            </dd>
          </div>
        </dl>
        {error ? (
          <p
            className="text-sm text-destructive"
            role="alert"
          >
            {error}
          </p>
        ) : null}
      </div>
    </Dialog>
  );
}

function environmentVersionKindKey(kind: string) {
  switch (kind) {
    case 'deploy':
      return 'environmentVersionKindDeploy';
    case 'upgrade':
      return 'environmentVersionKindUpgrade';
    case 'recovery':
      return 'environmentVersionKindRecovery';
    default:
      return 'environmentVersionKindUnknown';
  }
}
