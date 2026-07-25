/**
 * 设置 Tab
 *
 * 单一职责：渲染项目基本信息编辑表单（名称 / 描述）+ git 仓库展示 + 危险区删除。
 * 由原 ProjectOverviewPanel 的编辑能力迁入 —— 编辑属于"配置"，归设置，
 * 不应挤在概览里分散注意。
 *
 * 保存逻辑沿用原内联 apiRequest（PUT:/projects/:id），保持现有行为不变。
 * 删除走既有 project.delete 策略（risk high，审批走后端 access-policy），
 * 配 type-to-confirm（输入项目名）防误删 —— 参照 servers 删除模式。
 */

'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { usePersistFn } from '@svton/hooks';
import { apiRequest } from '@/lib/api-client';
import { feedback } from '@/components/ui/feedback/feedback';
import { Button, Input, Textarea } from '@/components/ui';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import type { useProjectDetail } from '../../hooks/use-project-detail';

type DetailHook = ReturnType<typeof useProjectDetail>;

export function SettingsTab({ detail }: { detail: DetailHook }) {
  const t = useTranslations('projects');
  const tc = useTranslations('common');
  const router = useRouter();
  const p = detail.project;
  const [deleteOpen, setDeleteOpen] = useState(false);

  const handleSave = usePersistFn(async () => {
    if (!p) return;
    await apiRequest(`PUT:/projects/${p.id}`, detail.editForm);
    detail.setEditing(false);
    detail.loadProject();
  });

  const handleCancel = usePersistFn(() => {
    if (!p) return;
    detail.setEditForm({ name: p.name, description: p.description ?? '' });
    detail.setEditing(false);
  });

  const handleDelete = usePersistFn(async () => {
    if (!p) return;
    await apiRequest(`DELETE:/projects/${p.id}`);
    feedback.success(t('deleteSuccess'));
    router.push('/projects');
  });

  if (!p) return null;

  return (
    <div className="max-w-2xl space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">{t('basicInfo')}</h2>
        {!detail.editing ? (
          <Button variant="ghost" size="sm" onClick={() => detail.setEditing(true)}>
            {t('edit')}
          </Button>
        ) : (
          <div className="flex gap-2">
            <Button variant="ghost" size="sm" onClick={handleCancel}>
              {tc('cancel')}
            </Button>
            <Button variant="primary" size="sm" onClick={handleSave}>
              {tc('save')}
            </Button>
          </div>
        )}
      </div>

      {detail.editing ? (
        <div className="space-y-3">
          <label className="block text-sm">
            <span className="mb-1 block font-medium">{t('nameLabel')}</span>
            <Input
              value={detail.editForm.name}
              onChange={(e) => detail.setEditForm({ name: e.target.value } as never)}
            />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block font-medium">{t('descriptionLabel')}</span>
            <Textarea
              value={detail.editForm.description}
              onChange={(e) => detail.setEditForm({ description: e.target.value } as never)}
            />
          </label>
        </div>
      ) : (
        <dl className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <dt className="text-muted-foreground">{t('nameLabel')}</dt>
            <dd className="font-medium">{p.name}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">{t('descriptionLabel')}</dt>
            <dd>{p.description || '-'}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">{t('gitRepoLabel')}</dt>
            <dd className="break-all font-mono text-xs">{p.gitRepo || t('notLinked')}</dd>
          </div>
        </dl>
      )}

      <div className="rounded-lg border border-destructive/50 p-6">
        <h2 className="mb-2 font-semibold text-destructive">{t('dangerZone')}</h2>
        <p className="mb-4 text-sm text-muted-foreground">{t('deleteProjectDescription')}</p>
        <Button variant="destructive" onClick={() => setDeleteOpen(true)}>
          {t('deleteProject')}
        </Button>
      </div>

      <ConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        tone="danger"
        title={t('deleteProjectTitle')}
        description={t('deleteProjectConfirm')}
        resourceName={p.name}
        confirmLabel={tc('delete')}
        cancelLabel={tc('cancel')}
        onConfirm={handleDelete}
      />
    </div>
  );
}
