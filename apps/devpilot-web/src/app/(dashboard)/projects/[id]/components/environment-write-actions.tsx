/**
 * 环境写操作区
 *
 * 单一职责:在环境详情抽屉里编排单个环境的写操作入口——
 *   - 编辑(name/status)
 *   - 归档(DELETE,即归档语义,走 ConfirmDialog danger)
 *   - 绑定/解绑服务器(委托 BindServerBlock)
 *
 * 普通环境变量(envVars)的编辑由 EnvironmentEnvVarsSection 负责,本组件不重复。
 */

'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Button, ConfirmDialog, Select } from '@/components/ui';
import { useEnvironmentActions } from '../hooks/use-environment-actions';
import { BindServerBlock } from './environment-bind-server-block';
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
  const [editStatus, setEditStatus] = useState(environment.status);
  const [archiveOpen, setArchiveOpen] = useState(false);

  useEffect(() => {
    setEditName(environment.name);
    setEditStatus(environment.status);
  }, [environment.id, environment.name, environment.status]);

  const isArchived = environment.status === 'archived';

  const submitEdit = async () => {
    const ok = await actions.update({
      name: editName.trim() || environment.name,
      status: editStatus,
    });
    if (ok) setEditing(false);
  };

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between">
        <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          {t('envActions')}
        </h4>
        {!isArchived ? (
          <div className="flex gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setEditing((v) => !v)}
              disabled={actions.acting}
            >
              {editing ? t('envCancelEdit') : t('envEdit')}
            </Button>
            <Button
              variant="destructive"
              size="sm"
              onClick={() => setArchiveOpen(true)}
              disabled={actions.acting}
            >
              {t('envArchive')}
            </Button>
          </div>
        ) : null}
      </div>

      {editing ? (
        <EditFields
          name={editName}
          status={editStatus}
          onName={setEditName}
          onStatus={setEditStatus}
          onSave={submitEdit}
          saving={actions.acting}
          t={t}
        />
      ) : (
        <BindServerBlock
          environment={environment}
          actions={actions}
          t={t}
        />
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
  status,
  onName,
  onStatus,
  onSave,
  saving,
  t,
}: {
  name: string;
  status: string;
  onName: (v: string) => void;
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
      <Button
        variant="primary"
        size="sm"
        onClick={onSave}
        loading={saving}
      >
        {t('envSave')}
      </Button>
    </div>
  );
}
