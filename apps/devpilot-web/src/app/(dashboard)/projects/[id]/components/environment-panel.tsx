/** 项目环境面板。 */
'use client';
import { useTranslations } from 'next-intl';
import { EmptyState } from '@svton/ui';
import { StatusTag } from '@/components/ui';
import type { useProjectDetail } from '../hooks/use-project-detail';
type DetailHook = ReturnType<typeof useProjectDetail>;

/** 环境状态值 → 本地化标签 key（避免 StatusTag 回退显示英文原值）。 */
function getEnvStatusLabelKey(status: string): string {
  const s = status.toLowerCase();
  if (s === 'active') return 'envStatusActive';
  if (s === 'inactive') return 'envStatusInactive';
  return 'envStatusUnknown';
}

export function EnvironmentPanel({ detail }: { detail: DetailHook }) {
  const t = useTranslations('projects');
  const p = detail.project;
  if (!p || !p.environments || p.environments.length === 0)
    return <EmptyState text={t('noEnvironments')} />;
  return (
    <div className="rounded-lg border p-4">
      <div className="mb-3">
        <h3 className="text-base font-semibold">{t('environments')}</h3>
        <p className="mt-1 text-sm text-muted-foreground">{t('environmentPanelDescription')}</p>
      </div>
      <div className="space-y-2">
        {p.environments.map((env) => (
          <div
            key={env.id}
            className="flex items-center justify-between rounded-md border px-3 py-2 text-sm"
          >
            <div className="flex items-baseline gap-2">
              <span className="font-medium">{env.name}</span>
              {/* 内部 key 仅作调试辅助，弱化展示，不作为主标签。 */}
              <span className="font-mono text-xs text-muted-foreground">{env.key}</span>
            </div>
            <StatusTag status={env.status} label={t(getEnvStatusLabelKey(env.status))} />
          </div>
        ))}
      </div>
    </div>
  );
}
