/** 项目环境面板。 */
'use client';
import { useTranslations } from 'next-intl';
import { EmptyState, Tag } from '@svton/ui';
import { StatusTag } from '@/components/ui';
import type { useProjectDetail } from '../hooks/use-project-detail';
type DetailHook = ReturnType<typeof useProjectDetail>;

export function EnvironmentPanel({ detail }: { detail: DetailHook }) {
  const t = useTranslations('projects');
  const p = detail.project;
  if (!p || !p.environments || p.environments.length === 0)
    return <EmptyState text={t('noEnvironments')} />;
  return (
    <div className="rounded-lg border p-4">
      <h2 className="mb-3 font-semibold">{t('environments')}</h2>
      <div className="space-y-2">
        {p.environments.map((env) => (
          <div
            key={env.id}
            className="flex items-center justify-between rounded-md border px-3 py-2 text-sm"
          >
            <span className="font-medium">{env.name}</span>
            <div className="flex items-center gap-2">
              <Tag color="default">{env.key}</Tag>
              <StatusTag status={env.status} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
