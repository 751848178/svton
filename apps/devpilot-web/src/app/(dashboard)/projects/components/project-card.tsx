import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { Tag } from '@svton/ui';
import { formatDate } from '@/lib/format-date';
import type { ProjectDirectoryItem } from '../types';

interface ProjectCardProps {
  project: ProjectDirectoryItem;
}

const ACTIVITY_LABELS = {
  analysis: 'activityAnalysis',
  deployment: 'activityDeployment',
  release: 'activityRelease',
  audit: 'activityAudit',
  intake: 'activityIntake',
  project: 'activityProject',
} as const;

const PROJECT_TYPE_LABELS: Record<string, string> = {
  web_application: 'projectTypeWebApplication',
  backend_service: 'projectTypeBackendService',
  static_site: 'projectTypeStaticSite',
  mixed_application: 'projectTypeMixedApplication',
};

const ARCHITECTURE_LABELS: Record<string, string> = {
  monorepo: 'architectureMonorepo',
  single_repository: 'architectureSingleRepository',
};

export function ProjectCard({ project }: ProjectCardProps) {
  const t = useTranslations('projects');
  const readyBaselines = [project.baselines.staging, project.baselines.production].filter(
    (baseline) => baseline?.ready,
  ).length;
  return (
    <article className="px-4 py-4 transition-colors hover:bg-muted/20">
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.45fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(11rem,.8fr)] lg:items-center">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="truncate text-base font-semibold">{project.name}</h2>
            <Tag color={project.status === 'online' ? 'green' : 'orange'}>
              {t(project.status === 'online' ? 'statusOnline' : 'statusNeedsConfiguration')}
            </Tag>
          </div>
          <p className="mt-1 truncate text-sm text-muted-foreground">
            {project.repository?.canonicalUrl ?? t('repositoryUnknown')}
          </p>
        </div>

        <DirectoryCell label={t('directoryType')}>
          <p>{label(t, PROJECT_TYPE_LABELS[project.intake.projectType ?? ''])}</p>
          <p className="text-xs text-muted-foreground">
            {label(t, ARCHITECTURE_LABELS[project.intake.architecture ?? ''])}
            {' · '}
            {project.intake.componentCount === null
              ? t('componentCountUnknown')
              : t('componentCount', { count: project.intake.componentCount })}
          </p>
        </DirectoryCell>

        <DirectoryCell label={t('directoryBaselines')}>
          <div className="flex flex-wrap gap-1.5">
            <BaselineTag
              name="Staging"
              ready={project.baselines.staging?.ready === true}
            />
            <BaselineTag
              name="Production"
              ready={project.baselines.production?.ready === true}
            />
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            {t('baselineReadiness', { ready: readyBaselines, total: 2 })}
          </p>
        </DirectoryCell>

        <DirectoryCell label="Production">
          <p className="font-medium">
            {project.production.currentVersion ?? t('productionNotReleased')}
          </p>
          <p className="truncate text-xs text-muted-foreground">
            {project.production.domain ?? t('domainNotConfigured')}
          </p>
        </DirectoryCell>

        <div className="flex items-center justify-between gap-4 lg:block">
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground lg:hidden">
              {t('directoryRecentActivity')}
            </p>
            <p className="text-sm">{t(ACTIVITY_LABELS[project.activity.type])}</p>
            <p className="text-xs text-muted-foreground">
              {formatDate(project.activity.occurredAt)}
            </p>
          </div>
          <Link
            href={`/projects/${project.id}`}
            className="inline-flex whitespace-nowrap rounded-md px-2 py-1 text-sm font-medium text-primary outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring lg:mt-2"
          >
            {t('enterProject')} →
          </Link>
        </div>
      </div>
    </article>
  );
}

function DirectoryCell({ label: title, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground lg:hidden">
        {title}
      </p>
      <div className="mt-1 text-sm lg:mt-0">{children}</div>
    </div>
  );
}

function BaselineTag({ name, ready }: { name: string; ready: boolean }) {
  return <Tag color={ready ? 'green' : 'default'}>{name}</Tag>;
}

function label(t: ReturnType<typeof useTranslations>, key?: string) {
  return key ? t(key) : t('directoryUnknown');
}
