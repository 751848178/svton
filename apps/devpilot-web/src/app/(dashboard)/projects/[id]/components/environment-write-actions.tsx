/**
 * 环境写操作区
 *
 * 单一职责:在环境详情抽屉里编排单个环境的写操作入口——
 *   - 编辑(name/description/reason,基线环境不含 status)
 *   - 归档(DELETE,即归档语义,走 ConfirmDialog danger;基线环境不提供)
 *   - 绑定/解绑服务器(委托 BindServerBlock)
 *
 * F444(AC-SET-012/014):显示名/描述是修订化身份字段,每次保存都会新建不可变修订
 * 并写入审计;Staging/Production 基线环境不展示归档入口且不提供 archived 状态。
 */

'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Button } from '@svton/ui';
import { ConfirmDialog, Select } from '@/components/ui';
import { useEnvironmentActions } from '../hooks/use-environment-actions';
import { BindServerBlock } from './environment-bind-server-block';
import { isBaselineEnvironment } from './settings/settings-env.model';
import type { ProjectEnvironment } from '../types';

type ProjectsTranslator = ReturnType<typeof useTranslations<'projects'>>;

export function EnvironmentWriteActions({
  environment,
  onSaved,
}: {
  environment: ProjectEnvironment;
  onSaved: (updated: ProjectEnvironment) => void;
}) {
  const t = useTranslations('projects');
  const actions = useEnvironmentActions({ environment, onSaved });

  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState(environment.name);
  const [editDescription, setEditDescription] = useState(environment.description ?? '');
  const [editReason, setEditReason] = useState('');
  const [editStatus, setEditStatus] = useState(environment.status);
  const [archiveOpen, setArchiveOpen] = useState(false);

  const baseline = isBaselineEnvironment(environment);

  useEffect(() => {
    setEditName(environment.name);
    setEditDescription(environment.description ?? '');
    setEditStatus(environment.status);
  }, [environment.id, environment.name, environment.description, environment.status]);

  const isArchived = environment.status === 'archived';

  const submitEdit = async () => {
    const ok = await actions.update({
      name: editName.trim() || environment.name,
      description: editDescription.trim() || null,
      reason: editReason.trim() || undefined,
      ...(baseline ? {} : { status: editStatus }),
    });
    if (ok) {
      setEditing(false);
      setEditReason('');
    }
  };

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between">
        <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          {t('envActions')}
        </h4>
        {!isArchived ? (
          <div className="flex gap-2">
            <Button variant="ghost" size="sm" onClick={() => setEditing((v) => !v)} disabled={actions.acting}>
              {editing ? t('envCancelEdit') : t('envEdit')}
            </Button>
            {!baseline ? (
              <Button variant="danger" size="sm" onClick={() => setArchiveOpen(true)} disabled={actions.acting}>
                {t('envArchive')}
              </Button>
            ) : null}
          </div>
        ) : null}
      </div>

      {editing ? (
        <EditFields
          name={editName}
          description={editDescription}
          reason={editReason}
          status={editStatus}
          baseline={baseline}
          onName={setEditName}
          onDescription={setEditDescription}
          onReason={setEditReason}
          onStatus={setEditStatus}
          onSave={submitEdit}
          saving={actions.acting}
          t={t}
        />
      ) : (
        <>
          {environment.description ? (
            <p className="text-xs text-muted-foreground">{environment.description}</p>
          ) : null}
          <BindServerBlock environment={environment} actions={actions} t={t} />
        </>
      )}

      <ConfirmDialog
        open={archiveOpen}
        onOpenChange={setArchiveOpen}
        tone="danger"
        title={t('envArchiveTitle')}
        description={t('envArchiveConfirm')}
        confirmLabel={t('envArchive')}
        onConfirm={async () => {
          const ok = await actions.archive();
          if (ok) setArchiveOpen(false);
        }}
      />
    </section>
  );
}

function EditFields({
  name,
  description,
  reason,
  status,
  baseline,
  onName,
  onDescription,
  onReason,
  onStatus,
  onSave,
  saving,
  t,
}: {
  name: string;
  description: string;
  reason: string;
  status: string;
  baseline: boolean;
  onName: (v: string) => void;
  onDescription: (v: string) => void;
  onReason: (v: string) => void;
  onStatus: (v: string) => void;
  onSave: () => void;
  saving: boolean;
  t: ProjectsTranslator;
}) {
  return (
    <div className="space-y-2">
      <label className="block text-sm">
        <span className="mb-1 block font-medium">{t('envNameLabel')}</span>
        <input
          value={name}
          onChange={(e) => onName(e.target.value)}
          className="w-full rounded-md border px-3 py-2"
        />
      </label>
      <label className="block text-sm">
        <span className="mb-1 block font-medium">{t('envDescriptionLabel')}</span>
        <textarea
          value={description}
          onChange={(e) => onDescription(e.target.value)}
          rows={2}
          className="w-full rounded-md border px-3 py-2"
        />
      </label>
      <label className="block text-sm">
        <span className="mb-1 block font-medium">{t('envIdentityReasonLabel')}</span>
        <input
          value={reason}
          onChange={(e) => onReason(e.target.value)}
          placeholder={t('envIdentityReasonPlaceholder')}
          className="w-full rounded-md border px-3 py-2"
        />
      </label>
      {!baseline ? (
        <label className="block text-sm">
          <span className="mb-1 block font-medium">{t('envStatusLabel')}</span>
          <Select
            value={status}
            onChange={(e) => onStatus(e.target.value)}
            options={[
              { value: 'active', label: t('envStatusActive') },
              { value: 'archived', label: t('envStatusArchived') },
            ]}
          />
        </label>
      ) : null}
      <Button variant="primary" size="sm" onClick={onSave} loading={saving}>
        {t('envSave')}
      </Button>
    </div>
  );
}
