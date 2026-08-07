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
import { Modal, Select } from '@/components/ui';
import type {
  EnvironmentDeploymentTargetBinding,
  EnvironmentDeploymentCurrentTarget,
} from '../../types';
import type { EnvironmentBindTargetInput } from '../../hooks/use-environment-actions';

type ProjectsTranslator = ReturnType<typeof useTranslations<'projects'>>;

const PROVIDER_OPTIONS = [
  { value: 'ssh-v1', labelKey: 'envTargetProviderSshV1' },
  { value: 'local-filesystem-v1', labelKey: 'envTargetProviderLocalFilesystemV1' },
];

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
    targetRef:
      current?.bindingId === binding.id ? current.targetRef : '',
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
  const [providerKey, setProviderKey] = useState('');
  const [root, setRoot] = useState('');
  const [targetRef, setTargetRef] = useState('');
  const [sharedEnvironmentIds, setSharedEnvironmentIds] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!draft) return;
    setProviderKey(draft.providerKey);
    setRoot(draft.root);
    setTargetRef(draft.targetRef);
    setSharedEnvironmentIds(draft.sharedEnvironmentIds);
  }, [draft?.bindingId, draft?.serverId, draft?.providerKey]);

  const submit = async () => {
    if (!draft) return;
    setSaving(true);
    try {
      const ok = await onConfirm({
        providerKey,
        root: root.trim() || undefined,
        targetRef: targetRef.trim() || undefined,
        sharedEnvironmentIds,
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
        <>
          <Button variant="secondary" onClick={onClose} disabled={saving}>{t('envCancel')}</Button>
          <Button variant="primary" onClick={submit} loading={saving} disabled={!draft || !providerKey}>
            {t('envTargetAdjustSave')}
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        <label className="block text-sm">
          <span className="mb-1 block font-medium">{t('envTargetProviderLabel')}</span>
          <Select
            value={providerKey}
            onChange={(e) => setProviderKey(e.target.value)}
            options={PROVIDER_OPTIONS.map((option) => ({ value: option.value, label: t(option.labelKey) }))}
          />
        </label>
        {providerKey === 'ssh-v1' ? (
          <label className="block text-sm">
            <span className="mb-1 block font-medium">{t('envTargetRootLabel')}</span>
            <input
              className="w-full rounded-md border bg-background px-2 py-1.5 text-sm"
              value={root}
              onChange={(e) => setRoot(e.target.value)}
              placeholder="/srv/app"
            />
            <span className="mt-1 block text-[11px] text-muted-foreground">{t('envTargetRootHint')}</span>
          </label>
        ) : (
          <label className="block text-sm">
            <span className="mb-1 block font-medium">{t('envTargetRefLabel')}</span>
            <input
              className="w-full rounded-md border bg-background px-2 py-1.5 text-sm"
              value={targetRef}
              onChange={(e) => setTargetRef(e.target.value)}
              placeholder="release-target://…"
            />
          </label>
        )}
        <fieldset className="text-sm">
          <legend className="mb-1 font-medium">{t('envTargetSharedScopeLabel')}</legend>
          <p className="mb-1 text-[11px] text-muted-foreground">{t('envTargetSharedScopeHint')}</p>
          {otherEnvironments.length === 0 ? (
            <p className="text-xs text-muted-foreground">{t('envTargetNoOtherEnvironments')}</p>
          ) : (
            <div className="space-y-1">
              {otherEnvironments.map((env) => {
                const checked = sharedEnvironmentIds.includes(env.id);
                return (
                  <label key={env.id} className="flex items-center gap-2 text-xs">
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() =>
                        setSharedEnvironmentIds((prev) =>
                          checked
                            ? prev.filter((id) => id !== env.id)
                            : [...prev, env.id],
                        )
                      }
                    />
                    <span>
                      {env.name}
                      <span className="ml-1 font-mono text-muted-foreground">{env.key}</span>
                    </span>
                  </label>
                );
              })}
            </div>
          )}
        </fieldset>
      </div>
    </Modal>
  );
}
