'use client';

import React, { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Dialog } from '@svton/ui';
import { Field, Select } from '@/components/ui';
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
  onConfirmed?: (result: RecoveryCreateResult, sourceVersionId: string) => void;
  onDirectConfirm?: (sourceVersionId: string) => Promise<void> | void;
}

/**
 * 环境版本回退对话框。
 *
 * 单一职责：选择历史成功版本并创建新的恢复部署——Production 走 F439 recovery
 * ReleaseRun + approval（onConfirmed），Staging 直接执行恢复部署（onDirectConfirm）。
 * 默认推荐该环境上一次成功版本（defaultSourceVersionId），当前版本永不列为候选。
 * 确认总是先取最新恢复快照再提交，配置漂移时服务端会强制基于最新快照重新确认。
 */
export function EnvironmentRecoveryDialog({
  projectId,
  environment,
  defaultSourceVersionId,
  onClose,
  onConfirmed,
  onDirectConfirm,
}: Props) {
  const t = useTranslations('projects');
  const { working, error, create } = useRecoveryConfirm(projectId);
  const [directWorking, setDirectWorking] = useState(false);
  const historical = environment.environmentVersions.filter(
    (version) => version.id !== environment.currentEnvironmentVersionId,
  );
  const defaultId = defaultSourceVersionId || historical[0]?.id || '';
  const [selectedId, setSelectedId] = useState(defaultId);
  const selected = historical.find((version) => version.id === selectedId) || null;
  const current = environment.environmentVersions.find(
    (version) => version.id === environment.currentEnvironmentVersionId,
  ) || null;

  const handleConfirm = async () => {
    if (!selected) return;
    if (onDirectConfirm) {
      setDirectWorking(true);
      try {
        await onDirectConfirm(selectedId);
      } finally {
        setDirectWorking(false);
      }
      onClose();
      return;
    }
    const result = await create(environment.id, selectedId);
    if (result) onConfirmed?.(result, selectedId);
  };

  const busy = working || directWorking;

  return (
    <Dialog
      open
      onClose={onClose}
      title={t('environmentVersionRecoveryDialogTitle')}
      confirmText={t('environmentVersionRecoveryCreateAction')}
      cancelText={t('releaseGateCancel')}
      ariaCloseLabel={t('releaseGateCancel')}
      onConfirm={() => void handleConfirm()}
      loading={busy}
      confirmDisabled={!selected || busy}
    >
      <div className="space-y-3">
        <p className="rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm text-amber-800">
          {t('environmentVersionRecoveryDialogCallout')}
        </p>
        <Field label={t('environmentVersionRecoveryTarget')}>
          <Select
            className="bg-background"
            value={selectedId}
            onChange={(event) => setSelectedId(event.target.value)}
            disabled={busy}
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
                {version.id === defaultId
                  ? t('environmentVersionRecoveryDefaultRecommend')
                  : ''}
              </option>
            ))}
          </Select>
        </Field>
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
