/**
 * 调整部署目标 - 编辑弹窗（AC-SET-018/019/020）
 *
 * 单一职责：对已绑定目标声明 Provider（ssh-v1/local-filesystem-v1）、SSH 根目录
 * 或 Provider targetRef，以及显式共享范围（默认隔离）。保存走绑定 API
 * （替换语义 + 连通性/冻结守卫），失败时把服务端诚实错误原样呈现。
 */

'use client';

import React, { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Button } from '@svton/ui';
import { Modal } from '@/components/ui';
import type {
  EnvironmentDeploymentTargetBinding,
  EnvironmentDeploymentCurrentTarget,
} from '../../types';
import type { EnvironmentBindTargetInput } from '../../hooks/use-environment-actions';
import { SettingsEnvTargetFields, type TargetFieldsValue } from './settings-env-target-fields';

export interface TargetEditDraft {
  bindingId: string;
  serverId: string;
  serverName: string;
  providerKey: string;
  root: string;
  targetRef: string;
  sharedEnvironmentIds: string[];
}

export function targetEditDraftFrom(
  binding: EnvironmentDeploymentTargetBinding,
  current: EnvironmentDeploymentCurrentTarget | null,
): TargetEditDraft | null {
  const metadata = binding.metadata as Record<string, unknown> | null;
  const deployment = metadata?.releaseDeployment as Record<string, unknown> | null;
  return {
    bindingId: binding.id,
    serverId: binding.server.id,
    serverName: binding.server.name,
    providerKey:
      binding.providerKey ??
      (typeof deployment?.providerKey === 'string' ? deployment.providerKey : ''),
    root: typeof deployment?.root === 'string' ? deployment.root : '',
    targetRef: current?.bindingId === binding.id ? current.targetRef : '',
    sharedEnvironmentIds: binding.sharedEnvironmentIds,
  };
}

export function SettingsEnvTargetEditDialog({
  open,
  draft,
  otherEnvironments,
  onClose,
  onConfirm,
}: {
  open: boolean;
  draft: TargetEditDraft | null;
  otherEnvironments: Array<{ id: string; key: string; name: string }>;
  onClose: () => void;
  onConfirm: (input: EnvironmentBindTargetInput) => Promise<boolean>;
}) {
  const t = useTranslations('projects');
  const [target, setTarget] = useState<TargetFieldsValue>({
    providerKey: '',
    root: '',
    targetRef: '',
    sharedEnvironmentIds: [],
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!draft) return;
    setTarget({
      providerKey: draft.providerKey,
      root: draft.root,
      targetRef: draft.targetRef,
      sharedEnvironmentIds: draft.sharedEnvironmentIds,
    });
  }, [draft]);

  const submit = async () => {
    if (!draft) return;
    setSaving(true);
    try {
      const ok = await onConfirm({
        providerKey: target.providerKey,
        root: target.root.trim() || undefined,
        targetRef: target.targetRef.trim() || undefined,
        sharedEnvironmentIds: target.sharedEnvironmentIds,
      });
      if (ok) onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={t('envTargetAdjustTitle')}
      width={440}
      footer={
        <div className="flex w-full flex-col items-end gap-1">
          <div className="flex justify-end gap-2">
            <Button
              variant="secondary"
              onClick={onClose}
              disabled={saving}
            >
              {t('envCancel')}
            </Button>
            <Button
              variant="primary"
              onClick={submit}
              loading={saving}
              disabled={!draft || !target.providerKey}
            >
              {t('envTargetAdjustSave')}
            </Button>
          </div>
          {!target.providerKey ? (
            <p className="text-xs text-muted-foreground">{t('envTargetProviderRequiredHint')}</p>
          ) : null}
        </div>
      }
    >
      <SettingsEnvTargetFields
        value={target}
        otherEnvironments={otherEnvironments}
        onChange={setTarget}
      />
    </Modal>
  );
}
