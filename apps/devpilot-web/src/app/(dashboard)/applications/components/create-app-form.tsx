/**
 * 创建应用表单
 *
 * 单一职责：收集应用基本信息并提交。
 */

'use client';

import { useTranslations } from 'next-intl';
import { usePersistFn } from '@svton/hooks';
import type { AppForm, Project } from '../types';

interface CreateAppFormProps {
  form: AppForm;
  onChange: (patch: Partial<AppForm>) => void;
  projects: Project[];
  saving: boolean;
  onCreate: () => void;
}

export function CreateAppForm({ form, onChange, projects, saving, onCreate }: CreateAppFormProps) {
  const t = useTranslations('applications');
  const handleCreate = usePersistFn(() => onCreate());
  return (
    <section className="rounded-lg border p-4">
      <h2 className="font-semibold">{t('createApp')}</h2>
      <div className="mt-4 space-y-3">
        <select
          value={form.projectId}
          onChange={(e) => onChange({ projectId: e.target.value })}
          className="w-full rounded-md border bg-background px-3 py-2 text-sm"
        >
          <option value="">{t('selectProject')}</option>
          {projects.map((p) => (
            <option
              key={p.id}
              value={p.id}
            >
              {p.name}
            </option>
          ))}
        </select>
        <input
          value={form.name}
          onChange={(e) => onChange({ name: e.target.value })}
          placeholder={t('appNamePlaceholder')}
          className="w-full rounded-md border bg-background px-3 py-2 text-sm"
        />
        <input
          value={form.repositoryUrl}
          onChange={(e) => onChange({ repositoryUrl: e.target.value })}
          placeholder={t('repoUrlPlaceholder')}
          className="w-full rounded-md border bg-background px-3 py-2 text-sm"
        />
        <div className="grid grid-cols-2 gap-2">
          <input
            value={form.defaultBranch}
            onChange={(e) => onChange({ defaultBranch: e.target.value })}
            placeholder={t('defaultBranchPlaceholder')}
            className="rounded-md border bg-background px-3 py-2 text-sm"
          />
          <input
            value={form.repoPath}
            onChange={(e) => onChange({ repoPath: e.target.value })}
            placeholder={t('repoPathPlaceholder')}
            className="rounded-md border bg-background px-3 py-2 text-sm"
          />
        </div>
        <button
          onClick={handleCreate}
          disabled={saving}
          className="w-full rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
        >
          {t('createApp')}
        </button>
      </div>
    </section>
  );
}
