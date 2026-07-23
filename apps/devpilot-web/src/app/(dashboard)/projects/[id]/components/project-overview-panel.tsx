/** 项目概览面板 - 基本信息 + 编辑 + 下载。 */
'use client';
import { useTranslations } from 'next-intl';
import { usePersistFn } from '@svton/hooks';
import { Tag } from '@svton/ui';
import { Button, Input, Textarea } from '@/components/ui';
import { formatDateTime } from '@/lib/format-date';
import type { useProjectDetail } from '../hooks/use-project-detail';
type DetailHook = ReturnType<typeof useProjectDetail>;

export function ProjectOverviewPanel({ detail }: { detail: DetailHook }) {
  const t = useTranslations('projects');
  const tc = useTranslations('common');
  const p = detail.project;
  const handleSave = usePersistFn(async () => {
    if (!p) return;
    const { apiRequest } = await import('@/lib/api-client');
    await apiRequest(`PUT:/projects/${p.id}`, detail.editForm);
    detail.setEditing(false);
    detail.loadProject();
  });
  if (!p) return null;
  return (
    <div className="rounded-lg border p-4 space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="font-semibold">{t('basicInfo')}</h2>
        {!detail.editing ? (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => detail.setEditing(true)}
          >
            {t('edit')}
          </Button>
        ) : (
          <div className="flex gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => detail.setEditing(false)}
            >
              {tc('cancel')}
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={handleSave}
            >
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
          <div>
            <dt className="text-muted-foreground">{t('createdAtLabel')}</dt>
            <dd>{formatDateTime(p.createdAt)}</dd>
          </div>
        </dl>
      )}
      {p.environments && p.environments.length > 0 && (
        <div className="flex flex-wrap gap-1 pt-2 border-t">
          {p.environments.map((env) => (
            <Tag
              key={env.id}
              color="default"
            >
              {env.name}
            </Tag>
          ))}
        </div>
      )}
    </div>
  );
}
