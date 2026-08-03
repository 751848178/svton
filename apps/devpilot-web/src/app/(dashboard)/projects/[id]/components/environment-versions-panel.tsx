import { useTranslations } from 'next-intl';
import { LinkButton } from '@/components/ui';
import type { useProjectDetail } from '../hooks/use-project-detail';

type DetailHook = ReturnType<typeof useProjectDetail>;

export function EnvironmentVersionsPanel({ detail }: { detail: DetailHook }) {
  const t = useTranslations('projects');
  const project = detail.project;
  if (!project) return null;
  const environments = ['staging', 'production'].map((role) => ({
    role,
    environment: project.environments?.find((item) => item.baselineRole === role),
  }));

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">{t('environmentVersionsDescription')}</p>
      <div className="grid gap-4 md:grid-cols-2">
        {environments.map(({ role, environment }) => (
          <article
            key={role}
            className="rounded-lg border p-5"
          >
            <div className="flex items-center justify-between gap-3">
              <h2 className="font-semibold">{role === 'staging' ? 'Staging' : 'Production'}</h2>
              <span className="text-xs text-muted-foreground">
                {environment ? t('baselineReady') : t('baselineMissing')}
              </span>
            </div>
            <p className="mt-4 text-sm font-medium">{t('environmentVersionUnavailable')}</p>
            <p className="mt-1 text-xs text-muted-foreground">
              {t('environmentVersionUnavailableDescription')}
            </p>
          </article>
        ))}
      </div>
      <LinkButton
        href={`/projects/${encodeURIComponent(project.id)}/settings?section=environments`}
        variant="outline"
      >
        {t('manageEnvironmentConfiguration')}
      </LinkButton>
    </div>
  );
}
